// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// Importar logger sanitizado
import { safeLog, safeErrorLog, sanitizeLogObject } from '../_shared/logger.ts';

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

/**
 * Valida a assinatura do webhook do Mercado Pago
 * Verifica se a requisição realmente veio do Mercado Pago
 */
function validateWebhookSignature(
  requestId: string | null,
  signature: string | null,
  secret: string
): boolean {
  // Se não tiver assinatura ou requestId, rejeita (em produção)
  // Em sandbox/teste pode ser mais flexível
  if (!requestId || !signature) {
    safeLog('[mercadopago-webhook] Assinatura ou requestId ausentes - aceitando para compatibilidade', {})
    return true; // Temporariamente aceita para não quebrar fluxos existentes
  }

  // Mercado Pago usa HMAC SHA256 com a chave secreta
  // A assinatura deve ser: x-signature: ts=timestamp;v1=signature
  
  try {
    // Extrair timestamp e assinatura do header
    const parts = signature.split(';');
    let timestamp = '';
    let v1Signature = '';
    
    parts.forEach(part => {
      const [key, value] = part.split('=');
      if (key === 'ts') timestamp = value;
      if (key === 'v1') v1Signature = value;
    });

    if (!timestamp || !v1Signature) {
      safeErrorLog('[mercadopago-webhook] Formato de assinatura inválido', { signature })
      return false;
    }

    // Verificar se o timestamp não é muito antigo (5 minutos)
    const now = Math.floor(Date.now() / 1000);
    const timestampNum = parseInt(timestamp, 10);
    if (Math.abs(now - timestampNum) > 300) { // 5 minutos
      safeErrorLog('[mercadopago-webhook] Timestamp muito antigo', { timestamp: timestampNum, now })
      return false;
    }

    // Criar string para assinar: {requestId}{timestamp}
    const dataToSign = `${requestId}${timestamp}`;
    
    // Criar HMAC SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(dataToSign);
    
    return crypto.subtle
      .importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(key => crypto.subtle.sign('HMAC', key, messageData))
      .then(signature => {
        const signatureArray = Array.from(new Uint8Array(signature));
        const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
        const expectedSignature = `v1=${signatureHex}`;
        
        const isValid = expectedSignature === v1Signature;
        if (!isValid) {
          safeErrorLog('[mercadopago-webhook] Assinatura inválida', { 
            expected: expectedSignature.substring(0, 20) + '...', 
            received: v1Signature.substring(0, 20) + '...' 
          });
        }
        return isValid;
      })
      .catch(err => {
        safeErrorLog('[mercadopago-webhook] Erro ao validar assinatura', err)
        return false;
      });
  } catch (error) {
    safeErrorLog('[mercadopago-webhook] Erro na validação de assinatura', error)
    return false;
  }
}

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

  // Verificar assinatura do webhook
  const xSignature = req.headers.get('x-signature');
  const xRequestId = req.headers.get('x-request-id');
  // @ts-ignore
  const MP_WEBHOOK_SECRET = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET') as string || '';

  // Se tiver secret configurado, validar assinatura
  let isValidSignature = true;
  if (MP_WEBHOOK_SECRET) {
    isValidSignature = await validateWebhookSignature(xRequestId, xSignature, MP_WEBHOOK_SECRET);
    if (!isValidSignature) {
      safeErrorLog('[mercadopago-webhook] Webhook rejeitado: assinatura inválida', {})
      return new Response(JSON.stringify({ received: false, error: 'Invalid signature' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }
    safeLog('[mercadopago-webhook] Assinatura validada com sucesso', {})
  } else {
    safeLog('[mercadopago-webhook] Webhook secret não configurado - pulando validação de assinatura', {})
  }

  // Fire-and-forget: record that we received a webhook (helps debugging)
  try {
    await supabaseAdmin.from('integration_logs').insert([{ event_type: 'mercadopago_notification', status: 'received', details: 'Webhook received', payload: sanitizeLogObject(rawBody) }])
  } catch (logErr) {
    safeErrorLog('[mercadopago-webhook] failed to record received integration_log', logErr)
  }

  // Load MP token
  // @ts-ignore
  const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') as string || ''

  const topic = rawBody?.topic || rawBody?.type || null
  const resourceId = rawBody?.data?.id || rawBody?.id || (rawBody?.data && rawBody.data.id)

  // Helper to safe-insert to webhook_retry_queue
  const queueForRetry = async (reason: string) => {
    try {
      await supabaseAdmin.from('webhook_retry_queue').insert([{ event_type: 'mercadopago_payment', order_id: null, payload: sanitizeLogObject(rawBody), status: 'pending', error_message: reason }])
      safeLog('[mercadopago-webhook] queued webhook for retry', { reason })
    } catch (qErr) {
      safeErrorLog('[mercadopago-webhook] failed to queue webhook retry', qErr)
      // fallback: record in integration_logs
      try { await supabaseAdmin.from('integration_logs').insert([{ event_type: 'mercadopago_notification', status: 'error', details: 'Failed to queue retry: ' + String(qErr), payload: sanitizeLogObject(rawBody) }]) } catch (e) { /* ignore */ }
    }
  }

  try {
    if (!resourceId) {
      safeLog('[mercadopago-webhook] no resource id in payload, nothing to process', {})
      // We still return 200 to acknowledge
      return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    if (!MERCADOPAGO_ACCESS_TOKEN) {
      safeErrorLog('[mercadopago-webhook] missing MERCADOPAGO_ACCESS_TOKEN env var', {})
      // queue for manual inspection
      await supabaseAdmin.from('integration_logs').insert([{ event_type: 'mercadopago_notification', status: 'error', details: 'Missing MP token', payload: sanitizeLogObject(rawBody) }])
      return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // Fetch payment details from Mercado Pago to confirm status and external_reference
    let paymentData: any = null
    try {
      const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, { headers: { 'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}` } })
      paymentData = await mpResp.json()
    } catch (mpErr) {
      safeErrorLog('[mercadopago-webhook] failed to fetch payment details from MP', mpErr)
      // queue for reprocessing (transient network or API error)
      await queueForRetry('Failed to fetch MP payment details: ' + String(mpErr))
      return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // Basic validation of paymentData
    const paymentStatus = (paymentData && (paymentData.status || paymentData.status_detail)) ? (paymentData.status || paymentData.status_detail) : null
    const externalReference = paymentData?.external_reference || paymentData?.order?.external_reference || null

    // Log the payment fetch
    try { await supabaseAdmin.from('integration_logs').insert([{ event_type: 'mercadopago_payment_fetch', status: 'fetched', details: 'Fetched MP payment', payload: sanitizeLogObject(paymentData) }]) } catch (e) { safeErrorLog('[mercadopago-webhook] failed to log mp fetch', e) }

    if (!externalReference) {
      safeLog('[mercadopago-webhook] payment has no external_reference, queuing for manual handling', {})
      await queueForRetry('No external_reference in MP payment')
      return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // Idempotency: check if this payment id was already processed
    try {
      const { data: existing } = await supabaseAdmin.from('integration_logs').select('id').eq('event_type', 'mercadopago_payment_processed').filter('payload->>payment_id', 'eq', String(resourceId)).limit(1).single()
      if (existing) {
        safeLog('[mercadopago-webhook] payment already processed, ignoring', { resourceId })
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      }
    } catch (e) {
      // ignore query errors and continue
    }

    // Try to find the order by external_reference
    const orderId = parseInt(String(externalReference))
    if (isNaN(orderId)) {
      safeLog('[mercadopago-webhook] external_reference is not numeric, queuing for manual handling', { externalReference })
      await queueForRetry('external_reference not numeric: ' + String(externalReference))
      return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    const { data: orderRow, error: orderErr } = await supabaseAdmin.from('orders').select('id, status').eq('id', orderId).single()
    if (orderErr || !orderRow) {
      safeErrorLog('[mercadopago-webhook] order not found, queuing for retry', orderErr)
      await queueForRetry('Order not found for external_reference: ' + String(externalReference))
      return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // If payment approved and order awaiting payment, finalize
    if (paymentStatus === 'approved' || (String(paymentStatus).toLowerCase().includes('approved'))) {
      try {
        if (orderRow.status === 'Aguardando Pagamento' || orderRow.status === 'pending' || orderRow.status === null) {
          const { error: finalizeError } = await supabaseAdmin.rpc('finalize_order_payment', { p_order_id: orderId })
          if (finalizeError) {
            safeErrorLog('[mercadopago-webhook] finalize_order_payment returned error', finalizeError)
            // queue for retry
            await queueForRetry('RPC finalize_order_payment error: ' + String(finalizeError))
            return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
          }
          // Record processed payment
          try {
            await supabaseAdmin.from('integration_logs').insert([{ event_type: 'mercadopago_payment_processed', status: 'processed', details: 'Payment approved and order finalized', payload: sanitizeLogObject({ payment_id: resourceId, external_reference, paymentStatus }) }])
          } catch (logE) { safeErrorLog('[mercadopago-webhook] failed to log processed payment', logE) }

          safeLog('[mercadopago-webhook] order finalized for', { orderId })
          return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        } else {
          // Order already in different status — record and ignore
          try { await supabaseAdmin.from('integration_logs').insert([{ event_type: 'mercadopago_payment_processed', status: 'no_action', details: `Order status is ${orderRow.status}; no action taken`, payload: sanitizeLogObject({ payment_id: resourceId, external_reference, paymentStatus }) }]) } catch (e) { /* ignore */ }
          safeLog('[mercadopago-webhook] payment approved but no action needed for order', { orderId, status: orderRow.status })
          return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
        }
      } catch (procErr) {
        safeErrorLog('[mercadopago-webhook] unexpected error processing payment', procErr)
        await queueForRetry('Unexpected processing error: ' + String(procErr))
        return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      }
    } else {
      // Payment not approved — record state and ignore
      try {
        await supabaseAdmin.from('integration_logs').insert([{ event_type: 'mercadopago_payment_processed', status: 'ignored', details: `Payment status: ${paymentStatus}`, payload: sanitizeLogObject({ payment_id: resourceId, externalReference, paymentStatus }) }])
      } catch (e) { safeErrorLog('[mercadopago-webhook] failed to log non-approved payment', e) }
      safeLog('[mercadopago-webhook] payment status is not approved', { paymentStatus })
      return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

  } catch (err) {
    // Catch-all: log and acknowledge so MP won't retry repeatedly
    safeErrorLog('[mercadopago-webhook] fatal handler error', err)
    try { await supabaseAdmin.from('integration_logs').insert([{ event_type: 'mercadopago_notification', status: 'error', details: String(err), payload: sanitizeLogObject(rawBody) }]) } catch (e) { /* ignore */ }

    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  }
})