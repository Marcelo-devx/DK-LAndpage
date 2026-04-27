// redeploy: 2026-04-27T02:00:00Z — force redeploy was 404
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Supabase client with Service Role Key for secure database updates
// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://jrlozhhvwqfmjtkmvukf.supabase.co'
// @ts-ignore
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE)

// redeploy: v2
serve(async (req) => {
  // Respond to preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  // Health check — mantém a função aquecida
  const url = new URL(req.url)
  if (req.method === 'GET' && url.pathname.endsWith('/health')) {
    return new Response(JSON.stringify({ status: 'ok', function: 'mercadopago-webhook', ts: Date.now() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  // Always return 200 to acknowledge receipt (MP retries if it gets non-200)
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  // Parse body
  let rawBody: any = null
  try {
    rawBody = await req.json()
  } catch (e) {
    rawBody = {}
  }

  // Extract payment ID - MP sends it in multiple ways:
  // 1. Query string: ?id=123&topic=payment (modern format)
  // 2. Body: { data: { id: "123" }, type: "payment" }
  // 3. Body: { id: "123", topic: "payment" }
  const queryId = url.searchParams.get('id') || url.searchParams.get('data.id')
  const queryTopic = url.searchParams.get('topic') || url.searchParams.get('type')

  const bodyId = rawBody?.data?.id || rawBody?.id
  const bodyTopic = rawBody?.type || rawBody?.topic

  const resourceId = queryId || bodyId
  const topic = queryTopic || bodyTopic

  console.log('[mercadopago-webhook] Received notification', {
    url: req.url,
    queryId,
    queryTopic,
    bodyId,
    bodyTopic,
    resourceId,
    topic,
    bodyKeys: Object.keys(rawBody || {})
  })

  // Log receipt
  try {
    await supabaseAdmin.from('integration_logs').insert([{
      event_type: 'mercadopago_notification',
      status: 'received',
      details: `topic=${topic} resourceId=${resourceId}`,
      payload: { rawBody, queryId, queryTopic, resourceId, topic }
    }])
  } catch (logErr) {
    console.error('[mercadopago-webhook] failed to record log', logErr)
  }

  // Only process payment notifications
  if (topic && topic !== 'payment' && topic !== 'merchant_order') {
    console.log('[mercadopago-webhook] Ignoring non-payment topic:', topic)
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  if (!resourceId) {
    console.log('[mercadopago-webhook] No resource ID found, acknowledging')
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  // @ts-ignore
  const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') as string || ''

  if (!MERCADOPAGO_ACCESS_TOKEN) {
    console.error('[mercadopago-webhook] Missing MERCADOPAGO_ACCESS_TOKEN')
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  try {
    // Fetch payment details from Mercado Pago
    console.log('[mercadopago-webhook] Fetching payment from MP:', resourceId)
    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
      headers: { 'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}` }
    })
    const paymentData: any = await mpResp.json()

    console.log('[mercadopago-webhook] MP payment response:', {
      status: paymentData?.status,
      status_detail: paymentData?.status_detail,
      external_reference: paymentData?.external_reference,
      id: paymentData?.id
    })

    // Log the fetch
    try {
      await supabaseAdmin.from('integration_logs').insert([{
        event_type: 'mercadopago_payment_fetch',
        status: 'fetched',
        details: `payment_status=${paymentData?.status} external_ref=${paymentData?.external_reference}`,
        payload: {
          payment_id: resourceId,
          status: paymentData?.status,
          status_detail: paymentData?.status_detail,
          external_reference: paymentData?.external_reference
        }
      }])
    } catch (e) { /* ignore log errors */ }

    const paymentStatus = paymentData?.status
    const externalReference = paymentData?.external_reference

    if (!externalReference) {
      console.log('[mercadopago-webhook] No external_reference in payment data')
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const orderId = parseInt(String(externalReference))
    if (isNaN(orderId)) {
      console.log('[mercadopago-webhook] external_reference is not numeric:', externalReference)
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Idempotency check — só bloqueia se o pedido JÁ foi finalizado com sucesso
    // (não bloqueia por logs de 'ignored' ou 'in_process')
    try {
      const { data: existing } = await supabaseAdmin
        .from('integration_logs')
        .select('id')
        .eq('event_type', 'mercadopago_payment_processed')
        .eq('status', 'processed')
        .filter('payload->>payment_id', 'eq', String(resourceId))
        .limit(1)
        .single()

      if (existing) {
        console.log('[mercadopago-webhook] Payment already successfully processed, ignoring:', resourceId)
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
    } catch (e) {
      // ignore - single() throws if no row found
    }

    // Find the order
    const { data: orderRow, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single()

    if (orderErr || !orderRow) {
      console.error('[mercadopago-webhook] Order not found:', orderId, orderErr)
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    console.log('[mercadopago-webhook] Order found:', { orderId, currentStatus: orderRow.status, paymentStatus })

    // Process approved payment
    if (paymentStatus === 'approved') {
      if (orderRow.status === 'Aguardando Pagamento' || orderRow.status === 'Pendente' || orderRow.status === 'Em Preparação') {
        console.log('[mercadopago-webhook] Finalizing order:', orderId)
        const { error: finalizeError } = await supabaseAdmin.rpc('finalize_order_payment', {
          p_order_id: orderId
        })

        if (finalizeError) {
          console.error('[mercadopago-webhook] finalize_order_payment error:', finalizeError)
          try {
            await supabaseAdmin.from('integration_logs').insert([{
              event_type: 'mercadopago_payment_processed',
              status: 'error',
              details: `finalize_order_payment failed: ${finalizeError.message}`,
              payload: { payment_id: resourceId, order_id: orderId, error: finalizeError.message }
            }])
          } catch (e) { /* ignore */ }
        } else {
          console.log('[mercadopago-webhook] Order finalized successfully:', orderId)
          try {
            await supabaseAdmin.from('integration_logs').insert([{
              event_type: 'mercadopago_payment_processed',
              status: 'processed',
              details: `Order ${orderId} finalized`,
              payload: { payment_id: resourceId, order_id: orderId, paymentStatus }
            }])
          } catch (e) { /* ignore */ }
        }
      } else {
        console.log('[mercadopago-webhook] Order already in status:', orderRow.status, '- no action needed')
        try {
          await supabaseAdmin.from('integration_logs').insert([{
            event_type: 'mercadopago_payment_processed',
            status: 'no_action',
            details: `Order ${orderId} already in status: ${orderRow.status}`,
            payload: { payment_id: resourceId, order_id: orderId, paymentStatus, orderStatus: orderRow.status }
          }])
        } catch (e) { /* ignore */ }
      }
    } else {
      console.log('[mercadopago-webhook] Payment not approved:', paymentStatus)
      try {
        await supabaseAdmin.from('integration_logs').insert([{
          event_type: 'mercadopago_payment_processed',
          status: 'ignored',
          details: `Payment status: ${paymentStatus}`,
          payload: { payment_id: resourceId, order_id: orderId, paymentStatus }
        }])
      } catch (e) { /* ignore */ }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err: any) {
    console.error('[mercadopago-webhook] Fatal error:', err?.message || err)
    try {
      await supabaseAdmin.from('integration_logs').insert([{
        event_type: 'mercadopago_notification',
        status: 'error',
        details: String(err?.message || err),
        payload: { rawBody, resourceId }
      }])
    } catch (e) { /* ignore */ }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})