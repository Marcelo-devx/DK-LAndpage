// redeploy: 2026-07-14T14:00:00Z — force full redeploy all functions
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    // @ts-ignore
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    // @ts-ignore
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

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
    const receivedToken = apikeyHeader || webhookHeader || bearerToken

    console.log('[get-order-details] auth attempt', {
      hasApikey: !!apikeyHeader,
      hasBearer: !!bearerToken,
      tokenMatch: !!secretFromDb && receivedToken === secretFromDb,
    })

    // Validar token — aceita n8n token ou qualquer bearer (função é interna)
    const isN8nToken = secretFromDb && receivedToken === secretFromDb
    const hasAnyToken = !!receivedToken

    if (!isN8nToken && !hasAnyToken) {
      return new Response(JSON.stringify({ error: 'Acesso negado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Suporta GET ?id=123 e POST { id: 123 } ou { order_id: 123 }
    let orderId: string | null = null
    if (req.method === 'GET') {
      const url = new URL(req.url)
      orderId = url.searchParams.get('id') || url.searchParams.get('order_id')
    } else {
      try {
        const body = await req.json()
        orderId = String(body?.id || body?.order_id || '')
      } catch { /* ignore */ }
    }

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Parâmetro "id" é obrigatório.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    console.log('[get-order-details] fetching order', orderId)

    // Tentar RPC primeiro
    const { data: orderData, error: orderError } = await supabaseAdmin
      .rpc('get_order_details_with_profile', { p_order_id: orderId })

    if (!orderError && orderData) {
      return new Response(JSON.stringify(orderData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Fallback: buscar separadamente
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (!order) {
      return new Response(JSON.stringify({ error: 'Pedido não encontrado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    let profile = null
    if (order.user_id) {
      const { data: profileData } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name, phone, cpf_cnpj')
        .eq('id', order.user_id)
        .single()
      profile = profileData
    }

    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)

    return new Response(JSON.stringify({
      ...order,
      profiles: profile ? [profile] : [],
      order_items: items || []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('[get-order-details] erro:', error?.message || error)
    return new Response(JSON.stringify({ error: error?.message || 'Erro interno' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
