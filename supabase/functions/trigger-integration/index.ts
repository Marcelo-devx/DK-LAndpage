import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getCorsHeaders, createPreflightResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://jrlozhhvwqfmjtkmvukf.supabase.co'
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

// Dispatch com retry (up to maxRetries attempts)
async function dispatchWithRetry(
  url: string,
  headers: Record<string, string>,
  body: string,
  maxRetries = 3,
  timeoutMs = 15000,
  requestId = 'unknown'
): Promise<{ ok: boolean; status?: number; body?: string; error?: string; attempts: number }> {
  let lastError = ''
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[trigger-integration][${requestId}] dispatch attempt ${attempt}/${maxRetries} to ${url}`)
      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      })
      const text = await resp.text().catch(() => '')
      console.log(`[trigger-integration][${requestId}] attempt ${attempt} response: status=${resp.status} body=${text.substring(0, 200)}`)
      if (resp.ok) {
        return { ok: true, status: resp.status, body: text, attempts: attempt }
      }
      lastError = `HTTP ${resp.status}: ${text.substring(0, 300)}`
      // Don't retry on 4xx (client errors) — only on 5xx or network issues
      if (resp.status >= 400 && resp.status < 500) {
        console.warn(`[trigger-integration][${requestId}] 4xx error, not retrying: ${lastError}`)
        return { ok: false, status: resp.status, body: text, error: lastError, attempts: attempt }
      }
    } catch (err: any) {
      lastError = String(err?.message || err)
      console.error(`[trigger-integration][${requestId}] attempt ${attempt} threw: ${lastError}`)
    }
    // Wait before retry: 1s, 2s, 4s
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt - 1) * 1000
      console.log(`[trigger-integration][${requestId}] waiting ${delay}ms before retry...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  return { ok: false, error: lastError, attempts: maxRetries }
}

// Build enriched order payload for n8n
async function buildOrderPayload(orderId: number, eventType: string, requestId = 'unknown'): Promise<any> {
  console.log(`[trigger-integration][${requestId}] fetching order ${orderId} from DB`)

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, total_price, shipping_cost, donation_amount, coupon_discount, payment_method, status, created_at, user_id, shipping_address, benefits_used, guest_email, guest_phone, guest_cpf_cnpj')
    .eq('id', orderId)
    .single()

  if (orderErr || !order) {
    console.error(`[trigger-integration][${requestId}] failed to fetch order`, orderErr)
    return null
  }

  // Fetch order items
  const { data: items } = await supabase
    .from('order_items')
    .select('item_id, item_type, name_at_purchase, quantity, price_at_purchase, image_url_at_purchase')
    .eq('order_id', orderId)

  const mappedItems = (items || []).map((it: any) => {
    const price = Number(it.price_at_purchase ?? 0)
    const qty = Number(it.quantity ?? 0)
    return {
      name: it.name_at_purchase || '',
      quantity: qty,
      price: price,
      total: +(price * qty).toFixed(2),
      image: it.image_url_at_purchase || null,
      type: it.item_type || 'product',
    }
  })

  // Use total_price directly from DB — it already includes shipping + donation - discount
  const totalPrice = Number(order.total_price ?? 0)
  const shippingCost = Number(order.shipping_cost ?? 0)
  const donationAmount = Number(order.donation_amount ?? 0)
  const couponDiscount = Number(order.coupon_discount ?? 0)
  const subtotalProducts = mappedItems.reduce((s: number, it: any) => s + it.total, 0)

  console.log(`[trigger-integration][${requestId}] order values from DB`, {
    orderId,
    total_price: totalPrice,
    shipping_cost: shippingCost,
    donation_amount: donationAmount,
    coupon_discount: couponDiscount,
    subtotal_products: subtotalProducts,
  })

  // Build customer info from shipping_address or guest fields
  const shipping = order.shipping_address || {}
  const customer = {
    id: order.user_id || null,
    full_name: [shipping.first_name, shipping.last_name].filter(Boolean).join(' ') || shipping.full_name || null,
    phone: (shipping.phone || order.guest_phone || '').replace(/\D/g, '') || null,
    email: shipping.email || order.guest_email || null,
    cpf: (shipping.cpf_cnpj || order.guest_cpf_cnpj || '').replace(/\D/g, '') || null,
  }

  return {
    event: eventType,
    timestamp: new Date().toISOString(),
    data: {
      id: Number(order.id),
      total_price: totalPrice,
      subtotal_products: +subtotalProducts.toFixed(2),
      shipping_cost: shippingCost,
      donation_amount: donationAmount,
      discount_applied: couponDiscount,
      payment_method: order.payment_method || 'Pix',
      status: order.status,
      created_at: order.created_at,
      benefits_used: order.benefits_used || null,
      customer,
      shipping_address: shipping,
      items: mappedItems,
    },
  }
}

serve(async (req) => {
  const requestId = crypto.randomUUID()
  const origin = req.headers.get('origin')
  console.log(`[trigger-integration][${requestId}] ${req.method} ${req.url}`, { origin })

  if (req.method === 'OPTIONS') {
    return createPreflightResponse(origin)
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  let body: any = null
  try {
    body = await req.json()
  } catch {
    console.error(`[trigger-integration][${requestId}] Invalid JSON body`)
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  console.log(`[trigger-integration][${requestId}] received body`, JSON.stringify(body).substring(0, 500))

  // Support simulate flag for admin tests
  if (body?.simulate) {
    console.log(`[trigger-integration][${requestId}] simulate mode — returning success without dispatching`)
    return new Response(JSON.stringify({ success: true, simulated: true }), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  // Extract event_type from various payload shapes
  const eventType: string =
    body?.event_type ||
    body?.payload?.event_type ||
    body?.event ||
    null

  if (!eventType) {
    console.error(`[trigger-integration][${requestId}] missing event_type in body`)
    return new Response(JSON.stringify({ error: 'event_type is required' }), {
      status: 400,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  console.log(`[trigger-integration][${requestId}] processing event_type:`, eventType)

  // Extract order_id from various payload shapes
  const orderId: number | null =
    Number(body?.payload?.order_id || body?.order_id || body?.data?.order_id || 0) || null

  // Build enriched payload for order events
  let outgoingPayload: any = null
  if (eventType === 'order_created' && orderId) {
    outgoingPayload = await buildOrderPayload(orderId, eventType, requestId)
    if (!outgoingPayload) {
      console.error(`[trigger-integration][${requestId}] could not build order payload for order`, orderId)
      // Still try to dispatch with raw body as fallback
      outgoingPayload = { event: eventType, timestamp: new Date().toISOString(), data: body?.payload ?? body }
    }
  } else {
    // Generic event — wrap as-is
    outgoingPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: body?.payload ?? body?.data ?? body,
    }
  }

  // Fetch n8n token from app_settings
  const { data: tokenSetting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'n8n_integration_token')
    .maybeSingle()
  const n8nToken: string = tokenSetting?.value || ''

  // Fetch active webhook configs for this event
  const { data: configs, error: configsErr } = await supabase
    .from('webhook_configs')
    .select('id, trigger_event, target_url, is_active, api_key_header_name, api_key_value, additional_headers')
    .eq('trigger_event', eventType)
    .eq('is_active', true)

  if (configsErr) {
    console.error(`[trigger-integration][${requestId}] error fetching webhook_configs`, configsErr)
    return new Response(JSON.stringify({ error: 'Failed to load webhook configs' }), {
      status: 500,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  console.log(`[trigger-integration][${requestId}] found ${configs?.length ?? 0} active webhook(s) for event "${eventType}"`)

  if (!configs || configs.length === 0) {
    console.warn(`[trigger-integration][${requestId}] no active webhook configs for event "${eventType}" — nothing to dispatch`)
    // Log this so admin can see it
    await supabase.from('integration_logs').insert({
      event_type: eventType,
      status: 'no_config',
      details: `Nenhum webhook ativo configurado para o evento "${eventType}"`,
      payload: outgoingPayload,
      response_code: null,
    }).catch(() => {})
    return new Response(JSON.stringify({ success: true, dispatched: [], warning: 'no active webhook configs' }), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  const bodyToSend = JSON.stringify(outgoingPayload)

  // Dispatch to all configured URLs in parallel
  const results = await Promise.allSettled(
    configs.map(async (cfg: any) => {
      const url: string = cfg.target_url

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // n8n token from app_settings
      if (n8nToken) {
        headers['apikey'] = n8nToken
      }

      // Custom API key from webhook_config
      if (cfg.api_key_header_name && cfg.api_key_value) {
        headers[cfg.api_key_header_name] = cfg.api_key_value
      }

      // Additional headers from config
      if (cfg.additional_headers && typeof cfg.additional_headers === 'object') {
        for (const [k, v] of Object.entries(cfg.additional_headers)) {
          if (k && typeof v === 'string') headers[k] = v
        }
      }

      console.log(`[trigger-integration][${requestId}] dispatching to ${url}`, {
        event: eventType,
        orderId,
        headerNames: Object.keys(headers),
        bodyPreview: bodyToSend.substring(0, 200),
      })

      const result = await dispatchWithRetry(url, headers, bodyToSend, 3, 15000, requestId)
      return { url, cfg_id: cfg.id, ...result }
    })
  )

  const dispatched = results.map(r =>
    r.status === 'fulfilled' ? r.value : { ok: false, error: String((r as any).reason) }
  )

  console.log(`[trigger-integration][${requestId}] dispatch summary`, dispatched.map(d => ({
    url: (d as any).url,
    ok: (d as any).ok,
    status: (d as any).status,
    attempts: (d as any).attempts,
    error: (d as any).error,
  })))

  // Persist logs
  try {
    const logRows = dispatched.map((d: any) => ({
      event_type: eventType,
      status: d.ok ? 'sent' : 'error',
      details: d.ok
        ? `✅ Enviado para ${d.url} em ${d.attempts} tentativa(s)`
        : `❌ Falha ao enviar para ${d.url}: ${d.error || d.body || 'unknown error'}`,
      payload: outgoingPayload,
      response_code: d.status ?? null,
    }))
    await supabase.from('integration_logs').insert(logRows)
  } catch (logErr) {
    console.error(`[trigger-integration][${requestId}] failed to persist integration_logs`, logErr)
  }

  const allOk = dispatched.every((d: any) => d.ok)
  return new Response(JSON.stringify({ success: allOk, dispatched }), {
    status: 200,
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
  })
})