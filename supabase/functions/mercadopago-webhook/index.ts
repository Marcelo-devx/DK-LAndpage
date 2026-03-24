// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Supabase client with Service Role Key for secure database updates
const SUPABASE_URL = // @ts-ignore
  Deno.env.get('SUPABASE_URL') ?? 'https://jrlozhhvwqfmjtkmvukf.supabase.co'
const SERVICE_ROLE = // @ts-ignore
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE)

serve(async (req) => {
  // Respond to preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Accept only POST from MP but always return 200 to acknowledge receipt
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ received: true, note: 'method ignored' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  let rawBody: any = null
  try {
    rawBody = await req.json()
  } catch (e) {
    rawBody = { raw: 'invalid_json' }
  }

  // Fire-and-forget: record that we received a webhook (helps debugging)
  try {
    await supabaseAdmin.from('integration_logs').insert([{ event_type: 'mercadopago_notification', status: 'received', details: 'Webhook received', payload: rawBody }])
  } catch (logErr) {
    console.warn('[mercadopago-webhook] failed to record received integration_log', logErr)
  }

  // Load MP token
  // @ts-ignore
  const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') as string || ''

  const topic = rawBody?.topic || rawBody?.type || null
  const resourceId = rawBody?.data?.id || rawBody?.id || (rawBody?.data && rawBody.data.id)

  // Helper to safe-insert to webhook_retry_queue
  const queueForRetry = async (reason: string) => {
    try {
      await supabaseAdmin.from('webhook_retry_queue').insert([{ event_type: 'mercadopago_payment', order_id: null, payload: rawBody, status: 'pending', error_message: reason }])
      console.log('[mercadopago-webhook] queued webhook for retry', reason)
    } catch (qErr) {
      console.error('[mercadopago-webhook] failed to queue webhook retry:', qErr)
      // fallback: record in integration_logs
      try { await supabaseAdmin.from('integration_logs').insert([{ event_type: 'mercadopago_notification', status: 'error', details: 'Failed to queue retry: ' + String(qErr), payload: rawBody }]) } catch (e) { /* ignore */ }
    }
  }

  try {
    if (!resourceId) {
      console.warn('[mercadopago-webhook] no resource id in payload, nothing to process')
      // We still return 200 to acknowledge
      return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (!MERCADOPAGO_ACCESS_TOKEN) {
      console.error('[mercadopago-webhook] missing MERCADOPAGO_ACCESS_TOKEN env var')
      // queue for manual inspection
      await supabaseAdmin.from('integration_logs').insert([{ event_type: 'mercadopago_notification', status: 'error', details: 'Missing MP token', payload: rawBody }])
      return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // Fetch payment details from Mercado Pago to confirm status and external_reference
    let paymentData: any = null
    try {
      const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, { headers: { 'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}` } })
      paymentData = await mpResp.json()
    } catch (mpErr) {
      console.error('[mercadopago-webhook] failed to fetch payment details from MP', mpErr)
      // queue for reprocessing (transient network or API error)
      await queueForRetry('Failed to fetch MP payment details: ' + String(mpErr))
      return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // Basic validation of paymentData
    const paymentStatus = (paymentData && (paymentData.status || paymentData.status_detail)) ? (paymentData.status || paymentData.status_detail) : null
    const externalReference = paymentData?.external_reference || paymentData?.order?.external_reference || null

    // Log the payment fetch
    try { await supabaseAdmin.from('integration_logs').insert([{ event_type: 'mercadopago_payment_fetch', status: 'fetched', details: 'Fetched MP payment', payload: paymentData }]) } catch (e) { console.warn('[mercadopago-webhook] failed to log mp fetch', e) }

    if (!externalReference) {
      console.warn('[mercadopago-webhook] payment has no external_reference, queuing for manual handling')
      await queueForRetry('No external_reference in MP payment')
      return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // Idempotency: check if this payment id was already processed
    try {
      const { data: existing } = await supabaseAdmin.from('integration_logs').select('id').eq('event_type', 'mercadopago_payment_processed').filter('payload->>payment_id', 'eq', String(resourceId)).limit(1).single()
      if (existing) {
        console.log('[mercadopago-webhook] payment already processed, ignoring', resourceId)
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      }
    } catch (e) {
      // ignore query errors and continue
    }

    // Try to find the order by external_reference
    const orderId = parseInt(String(externalReference))
    if (isNaN(orderId)) {
      console.warn('[mercadopago-webhook] external_reference is not numeric, queuing for manual handling', externalReference)
      await queueForRetry('external_reference not numeric: ' + String(externalReference))
      return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    const { data: orderRow, error: orderErr } = await supabaseAdmin.from('orders').select('id, status').eq('id', orderId).single()
    if (orderErr || !orderRow) {
      console.warn('[mercadopago-webhook] order not found, queuing for retry', orderErr)
      await queueForRetry('Order not found for external_reference: ' + String(externalReference))
      return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // If payment approved and order awaiting payment, finalize
    if (paymentStatus === 'approved' || (String(paymentStatus).toLowerCase().includes('approved'))) {
      try {
        if (orderRow.status === 'Aguardando Pagamento' || orderRow.status === 'pending' || orderRow.status === null) {
          const { error: finalizeError } = await supabaseAdmin.rpc('finalize_order_payment', { p_order_id: orderId })
          if (finalizeError) {
            console.error('[mercadopago-webhook] finalize_order_payment returned error', finalizeError)
            // queue for retry
            await queueForRetry('RPC finalize_order_payment error: ' + String(finalizeError))
            return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
          }
          // Record processed payment
          try {
            await supabaseAdmin.from('integration_logs').insert([{ event_type: 'mercadopago_payment_processed', status: 'processed', details: 'Payment approved and order finalized', payload: { payment_id: resourceId, external_reference, paymentStatus } }])
          } catch (logE) { console.warn('[mercadopago-webhook] failed to log processed payment', logE) }

          console.log('[mercadopago-webhook] order finalized for', orderId)
          return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        } else {
          // Order already in different status — record and ignore
          try { await supabaseAdmin.from('integration_logs').insert([{ event_type: 'mercadopago_payment_processed', status: 'no_action', details: `Order status is ${orderRow.status}; no action taken`, payload: { payment_id: resourceId, external_reference, paymentStatus } }]) } catch (e) { /* ignore */ }
          console.log('[mercadopago-webhook] payment approved but no action needed for order', orderId, orderRow.status)
          return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }
      } catch (procErr) {
        console.error('[mercadopago-webhook] unexpected error processing payment', procErr)
        await queueForRetry('Unexpected processing error: ' + String(procErr))
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      }
    } else {
      // Payment not approved — record state and ignore
      try {
        await supabaseAdmin.from('integration_logs').insert([{ event_type: 'mercadopago_payment_processed', status: 'ignored', details: `Payment status: ${paymentStatus}`, payload: { payment_id: resourceId, external_reference, paymentStatus } }])
      } catch (e) { console.warn('[mercadopago-webhook] failed to log non-approved payment', e) }
      console.log('[mercadopago-webhook] payment status is not approved', paymentStatus)
      return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

  } catch (err) {
    // Catch-all: log and acknowledge so MP won't retry repeatedly
    console.error('[mercadopago-webhook] fatal handler error', err)
    try { await supabaseAdmin.from('integration_logs').insert([{ event_type: 'mercadopago_notification', status: 'error', details: String(err), payload: rawBody }]) } catch (e) { /* ignore */ }

    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})