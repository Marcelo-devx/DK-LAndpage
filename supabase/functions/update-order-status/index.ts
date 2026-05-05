// redeploy: 2026-05-05T19:45:00Z — restart all
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-webhook-token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url)
  if (req.method === 'GET' && url.pathname.endsWith('/health')) {
    return new Response(JSON.stringify({ status: 'ok', function: 'update-order-status', ts: Date.now() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  try {
    // @ts-ignore
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    // @ts-ignore
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    // @ts-ignore
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // Buscar token configurado no banco
    const { data: tokenSetting } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'n8n_integration_token')
      .maybeSingle()
    const secretFromDb = (tokenSetting?.value || '').trim()

    // Coletar token recebido de qualquer header possível
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || ''
    const apikeyHeader = req.headers.get('apikey') || ''
    const webhookHeader = req.headers.get('x-webhook-secret') || req.headers.get('x-webhook-token') || ''
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim()

    // Token recebido: prioridade apikey > x-webhook-secret > bearer
    const receivedToken = apikeyHeader || webhookHeader || bearerToken

    console.log('[update-order-status] auth attempt', {
      hasApikey: !!apikeyHeader,
      hasWebhook: !!webhookHeader,
      hasBearer: !!bearerToken,
      secretFromDb: !!secretFromDb,
      tokenMatch: receivedToken === secretFromDb,
    })

    // 1) Verificar se é o token do n8n
    if (secretFromDb && receivedToken === secretFromDb) {
      console.log('[update-order-status] authorized via n8n token')
      // autorizado — continua abaixo
    } else if (bearerToken) {
      // 2) Tentar validar como JWT de usuário admin
      const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(bearerToken)
      if (authError || !user) {
        console.error('[update-order-status] invalid JWT', authError?.message)
        return new Response(JSON.stringify({ error: 'Token inválido.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const { data: profile } = await supabaseAnon.from('profiles').select('role').eq('id', user.id).single()
      if (!profile || profile.role !== 'adm') {
        return new Response(JSON.stringify({ error: 'Acesso negado.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      console.log('[update-order-status] authorized via admin JWT', user.email)
    } else {
      console.error('[update-order-status] no valid credentials')
      return new Response(JSON.stringify({ error: 'Acesso negado. Requer autenticação.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const { order_id, status, delivery_status, tracking_code, delivery_info } = body

    if (!order_id) {
      return new Response(JSON.stringify({ error: 'order_id é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('[update-order-status] processing', { order_id, status })

    let responseData: any
    const s = (status || '').toLowerCase()

    if (status === 'Finalizada' || status === 'Pago' || s === 'confirmado' || s === 'approved' || s === 'paid') {
      if (delivery_status || tracking_code || delivery_info) {
        const updates: any = {}
        if (delivery_status) updates.delivery_status = delivery_status
        if (tracking_code) updates.delivery_info = `Rastreio: ${tracking_code}`
        else if (delivery_info) updates.delivery_info = delivery_info
        await supabaseAdmin.from('orders').update(updates).eq('id', order_id)
      }

      const { error } = await supabaseAdmin.rpc('finalize_order_payment', { p_order_id: order_id })
      if (error) throw error

      const { data: updatedOrder } = await supabaseAdmin.from('orders').select('*').eq('id', order_id).single()
      responseData = updatedOrder

      await supabaseAdmin.from('integration_logs').insert({
        event_type: 'api_payment_confirmed',
        status: 'success',
        payload: { order_id, input_status: status },
        details: `Pedido #${order_id} finalizado.`
      })
    } else {
      const updates: any = {}
      if (status) updates.status = status
      if (delivery_status) updates.delivery_status = delivery_status
      if (tracking_code) updates.delivery_info = `Rastreio: ${tracking_code}`
      else if (delivery_info) updates.delivery_info = delivery_info

      const { data, error } = await supabaseAdmin
        .from('orders')
        .update(updates)
        .eq('id', order_id)
        .select()
        .single()

      if (error) throw error
      responseData = data

      await supabaseAdmin.from('integration_logs').insert({
        event_type: 'api_update_order',
        status: 'success',
        payload: { order_id, updates },
        details: `Pedido #${order_id} atualizado.`
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Pedido atualizado com sucesso.',
      data: responseData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('[update-order-status] erro:', error?.message || error)
    return new Response(JSON.stringify({ error: error?.message || 'Erro interno' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
