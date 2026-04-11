import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getCorsHeaders, createPreflightResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://jrlozhhvwqfmjtkmvukf.supabase.co'
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

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
      if (resp.status >= 400 && resp.status < 500) {
        console.warn(`[trigger-integration][${requestId}] 4xx error, not retrying: ${lastError}`)
        return { ok: false, status: resp.status, body: text, error: lastError, attempts: attempt }
      }
    } catch (err: any) {
      lastError = String(err?.message || err)
      console.error(`[trigger-integration][${requestId}] attempt ${attempt} threw: ${lastError}`)
    }

    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt - 1) * 1000
      console.log(`[trigger-integration][${requestId}] waiting ${delay}ms before retry...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }

  return { ok: false, error: lastError, attempts: maxRetries }
}

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

  const shipping = order.shipping_address || {}
  let customerEmail: string | null = shipping.email || order.guest_email || null

  if (!customerEmail && order.user_id) {
    try {
      const { data: authUserData, error: authUserErr } = await supabase.auth.admin.getUserById(order.user_id)
      if (authUserErr) {
        console.warn(`[trigger-integration][${requestId}] auth.admin.getUserById error for user ${order.user_id}:`, authUserErr)
      } else {
        customerEmail = authUserData?.user?.email || null
        console.log(`[trigger-integration][${requestId}] resolved email via auth.admin for user ${order.user_id}: ${customerEmail}`)
      }
    } catch (authErr) {
      console.warn(`[trigger-integration][${requestId}] auth.admin.getUserById threw for user ${order.user_id}:`, authErr)
    }
  }

  const rawPhone = (shipping.phone || order.guest_phone || '').replace(/\D/g, '')

  // Normaliza o número para formato internacional brasileiro (DDI 55).
  // Remove DDI duplicado se já existir.
  let basePhone = rawPhone
  if (basePhone.startsWith('55') && basePhone.length >= 12) {
    basePhone = basePhone.slice(2) // remove o 55 para trabalhar só com DDD+número
  }

  // Gera variações do número para maximizar a chance de match no n8n:
  // O WhatsApp pode ter o número com ou sem o dígito 9 (celular brasileiro).
  // Ex: DDD 32 + 99121-3190 (com 9) ou DDD 32 + 9121-3190 (sem 9)
  let phoneWithNine: string | null = null
  let phoneWithoutNine: string | null = null

  if (basePhone.length === 11) {
    // Já tem o 9: ex 32991213190 → com9=5532991213190, sem9=553291213190
    phoneWithNine = '55' + basePhone
    phoneWithoutNine = '55' + basePhone.slice(0, 2) + basePhone.slice(3) // remove o 9 após o DDD
  } else if (basePhone.length === 10) {
    // Sem o 9: ex 3291213190 → sem9=553291213190, com9=5532991213190
    phoneWithoutNine = '55' + basePhone
    phoneWithNine = '55' + basePhone.slice(0, 2) + '9' + basePhone.slice(2) // insere o 9 após o DDD
  }

  // Número principal enviado ao n8n (com 9, formato padrão atual)
  const formattedPhone = phoneWithNine || (rawPhone ? '55' + rawPhone : null)

  const customer = {
    id: order.user_id || null,
    full_name: [shipping.first_name, shipping.last_name].filter(Boolean).join(' ') || shipping.full_name || null,
    phone: formattedPhone,
    phone_alt: phoneWithoutNine || null, // variação sem o dígito 9, para o n8n usar como fallback
    email: customerEmail,
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

  if (body?.simulate) {
    console.log(`[trigger-integration][${requestId}] simulate mode — returning success without dispatching`)
    return new Response(JSON.stringify({ success: true, simulated: true }), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

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

  console.log(`[trigger-integration][${requestId}] processing event_type: ${eventType}`)

  const orderId: number | null = Number(body?.payload?.order_id || body?.order_id || body?.data?.order_id || 0) || null

  let outgoingPayload: any = null
  if (eventType === 'order_created' && orderId) {
    outgoingPayload = await buildOrderPayload(orderId, eventType, requestId)
    if (!outgoingPayload) {
      console.error(`[trigger-integration][${requestId}] could not build order payload for order ${orderId}`)
      outgoingPayload = { event: eventType, timestamp: new Date().toISOString(), data: body?.payload ?? body }
    }
  } else {
    outgoingPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: body?.payload ?? body?.data ?? body,
    }
  }

  const { data: tokenSetting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'n8n_integration_token')
    .maybeSingle()
  const n8nToken: string = tokenSetting?.value || ''

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
    await supabase.from('integration_logs').insert({
      event_type: eventType,
      status: 'no_config',
      details: `Nenhum webhook ativo configurado para o evento "${eventType}"`,
      payload: outgoingPayload,
    })

    return new Response(JSON.stringify({
      success: false,
      dispatched: 0,
      reason: 'no_config',
      event_type: eventType,
    }), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  const results = []

  for (const config of configs) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (config.api_key_header_name && config.api_key_value) {
      headers[config.api_key_header_name] = config.api_key_value
    }

    if (n8nToken) {
      headers['Authorization'] = `Bearer ${n8nToken}`
    }

    if (config.additional_headers && typeof config.additional_headers === 'object') {
      for (const [key, value] of Object.entries(config.additional_headers)) {
        if (typeof value === 'string' && value.trim()) {
          headers[key] = value
        }
      }
    }

    const dispatchResult = await dispatchWithRetry(
      config.target_url,
      headers,
      JSON.stringify(outgoingPayload),
      3,
      15000,
      requestId
    )

    results.push({
      config_id: config.id,
      target_url: config.target_url,
      ...dispatchResult,
    })

    await supabase.from('integration_logs').insert({
      event_type: eventType,
      status: dispatchResult.ok ? 'success' : 'error',
      payload: outgoingPayload,
      response_code: dispatchResult.status ?? null,
      details: dispatchResult.ok
        ? `Webhook enviado para ${config.target_url}`
        : `Falha ao enviar para ${config.target_url}: ${dispatchResult.error || 'erro desconhecido'}`,
    })
  }

  const successCount = results.filter((item) => item.ok).length

  return new Response(JSON.stringify({
    success: successCount > 0,
    event_type: eventType,
    dispatched: results.length,
    success_count: successCount,
    results,
  }), {
    status: 200,
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
  })
})
