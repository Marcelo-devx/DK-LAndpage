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
          .select('*, order_items(*), profiles(*)')
          .eq('id', orderId)
          .single()
        if (orderErr) {
          console.warn('[trigger-integration] could not fetch order details', { orderErr })
        } else if (orderData) {
          payload = { ...payload, order: orderData }
          console.log('[trigger-integration] order details attached')
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
      try {
        console.log('[trigger-integration] dispatching to', url)
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: eventType, payload })
        })
        const text = await resp.text().catch(() => null)
        console.log('[trigger-integration] dispatched to', url, { status: resp.status })
        return { url, ok: resp.ok, status: resp.status, statusText: resp.statusText, body: text }
      } catch (err) {
        console.error('[trigger-integration] dispatch error to', url, err)
        return { url, ok: false, error: String(err) }
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