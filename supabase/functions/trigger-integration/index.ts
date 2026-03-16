import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// Use the service role key inside Edge Function so we can read webhook_configs despite RLS
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://jrlozhhvwqfmjtkmvukf.supabase.co'
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

if (!SUPABASE_SERVICE_ROLE) console.warn('[trigger-integration] WARNING: SUPABASE_SERVICE_ROLE_KEY is not set; webhook_configs RLS may block reads')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('[trigger-integration] OPTIONS preflight received')
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      console.log('[trigger-integration] method not allowed')
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json().catch(() => null)
    console.log('[trigger-integration] payload received', { body })

    const eventType = body?.event_type || (body?.payload && body.payload.event_type) || null
    let payload = body?.payload ?? body ?? null

    if (!eventType) {
      console.log('[trigger-integration] missing event_type')
      return new Response(JSON.stringify({ error: 'event_type is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // If simulate flag present, short-circuit (for admin tests)
    if (body?.simulate) {
      console.log('[trigger-integration] simulate flag detected — returning success')
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // If this is an order_created event and payload includes order_id, enrich payload with full order data
    try {
      if (eventType === 'order_created' && payload && payload.order_id) {
        console.log('[trigger-integration] enriching order_created payload with order details for', payload.order_id)
        const orderId = Number(payload.order_id)
        const { data: orderData, error: orderErr } = await supabase
          .from('orders')
          .select('*, order_items(*), user_id, shipping_address')
          .eq('id', orderId)
          .single()
        if (orderErr) {
          console.warn('[trigger-integration] could not fetch order details', { orderErr })
        } else if (orderData) {
          // Normalize order and items
          const order = orderData
          let items = order.order_items || []
          // If items are empty, try to fetch explicitly
          if (!items || items.length === 0) {
            const { data: fetchedItems } = await supabase.from('order_items').select('*').eq('order_id', orderId)
            items = fetchedItems || []
          }

          // Build items array in the required shape
          const mappedItems = items.map((it: any) => {
            const price = Number(it.price_at_purchase ?? it.price ?? 0)
            const qty = Number(it.quantity ?? 0)
            return {
              name: it.name_at_purchase || it.name || '',
              quantity: qty,
              price: price,
              total: +(price * qty).toFixed(2),
              image: it.image_url_at_purchase || it.image_url || null,
              type: it.item_type || 'product'
            }
          })

          const subtotal_products = mappedItems.reduce((s: number, it: any) => s + (it.price * it.quantity), 0)

          // Customer info: prefer shipping_address fields, fallback to profile if available
          const shipping = order.shipping_address || {}
          const customer = {
            id: order.user_id || null,
            full_name: (shipping.first_name && shipping.last_name) ? `${shipping.first_name} ${shipping.last_name}` : (shipping.full_name || null),
            phone: shipping.phone ? String(shipping.phone).replace(/\D/g, '') : (shipping.phone || null),
            email: shipping.email || order.guest_email || null,
            cpf: shipping.cpf_cnpj ? String(shipping.cpf_cnpj).replace(/\D/g, '') : (shipping.cpf_cnpj || null)
          }

          // CORRECTED: Calculate FINAL total including items, shipping, donation and discount
          const totalFinal = (subtotal_products + Number(order.shipping_cost ?? 0) + Number(order.donation_amount ?? 0) - Number(order.coupon_discount ?? 0))
          const total_price = isNaN(totalFinal) ? subtotal_products : totalFinal

          // Assemble the standardized payload required by n8n
          const outgoing = {
            event: eventType,
            timestamp: new Date().toISOString(),
            data: {
              id: Number(order.id),
              total_price: total_price,
              subtotal_products: +subtotal_products.toFixed(2),
              discount_applied: Number(order.coupon_discount ?? 0),
              shipping_cost: Number(order.shipping_cost ?? 0),
              donation_amount: Number(order.donation_amount ?? 0),
              payment_method: order.payment_method || (shipping.payment_method || 'pix'),
              status: order.status,
              created_at: order.created_at,
              coupon_name: order.coupon_name || null,
              benefits_used: order.benefits_used || null,
              customer,
              shipping_address: shipping,
              items: mappedItems
            }
          }

          payload = outgoing
          console.log('[trigger-integration] built outgoing payload for n8n', { orderId, outgoingPreview: { id: outgoing.data.id, total_price: outgoing.data.total_price, items_count: outgoing.data.items.length } })
        }
      }
    } catch (enrichErr) {
      console.error('[trigger-integration] error enriching payload', enrichErr)
    }

    // Fetch active webhook targets for this event
    console.log('[trigger-integration] fetching webhook configs for', eventType)
    const { data: configs, error: configsErr } = await supabase.from('webhook_configs').select('id, trigger_event, target_url, is_active').eq('trigger_event', eventType).eq('is_active', true)
    if (configsErr) {
      console.error('[trigger-integration] error fetching webhook_configs', { error: configsErr })
      return new Response(JSON.stringify({ error: 'Failed to load webhook configs' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log('[trigger-integration] webhook configs count:', configs?.length ?? 0)

    if (!configs || configs.length === 0) {
      console.log('[trigger-integration] no active webhook configs for', eventType)
      return new Response(JSON.stringify({ success: true, dispatched: [] }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Dispatch to each configured URL in parallel
    const results = await Promise.allSettled(configs.map(async (cfg: any) => {
      const url = cfg.target_url

      // Build the exact body to send: if we've already constructed outgoing payload (for orders), send that, otherwise wrap generic
      const bodyToSend = JSON.stringify(payload && payload.event ? payload : { event: eventType, timestamp: new Date().toISOString(), data: payload })

      try {
        console.log('[trigger-integration] dispatching to', url, 'with body preview:', { eventType, previewId: payload?.data?.id ?? payload?.order_id ?? null })
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyToSend,
          signal: AbortSignal.timeout(10000)
        })

        const text = await resp.text().catch(() => null)
        console.log('[trigger-integration] response from', url, { status: resp.status, ok: resp.ok, body: text })
        return { url, ok: resp.ok, status: resp.status, statusText: resp.statusText, body: text }
      } catch (err: any) {
        console.error('[trigger-integration] dispatch error to', url, 'Error details:', {
          name: err?.name,
          message: err?.message,
          cause: err?.cause
        })
        return { url, ok: false, error: String(err), details: err?.message }
      }
    }))

    const dispatched = results.map(r => r.status === 'fulfilled' ? r.value : { ok: false, error: (r as any).reason })
    console.log('[trigger-integration] dispatch results', { dispatched })

    // Persist dispatch results into integration_logs for auditing
    try {
      const logRows = dispatched.map((d: any) => ({
        event_type: eventType,
        status: d.ok ? 'sent' : 'error',
        details: d.ok ? `Disparado para ${d.url}` : `Erro ao disparar para ${d.url}: ${d.error || d.statusText}`,
        payload: payload ? payload : null,
        response_code: d.status ?? null
      }));
      await supabase.from('integration_logs').insert(logRows);
      console.log('[trigger-integration] persisted dispatch logs to integration_logs')
    } catch (logErr) {
      console.error('[trigger-integration] failed to persist integration_logs', logErr)
    }

    return new Response(JSON.stringify({ success: true, dispatched }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('[trigger-integration] error', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})