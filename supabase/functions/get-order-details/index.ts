// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const orderId = url.searchParams.get('id')

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Parâmetro "id" é obrigatório.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // SOLUÇÃO: Fazer o JOIN manual via SQL em vez de usar o select aninhado
    const { data: orderData, error: orderError } = await supabaseClient
      .rpc('get_order_details_with_profile', { p_order_id: orderId })

    if (orderError) {
      console.error("Erro ao buscar pedido:", orderError);
      
      // FALLBACK: Se a função RPC não existe, buscar separadamente
      const { data: order } = await supabaseClient
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
      
      // Buscar perfil separadamente se user_id existir
      let profile = null
      if (order.user_id) {
        const { data: profileData } = await supabaseClient
          .from('profiles')
          .select('first_name, last_name, email: id, phone, cpf_cnpj')
          .eq('id', order.user_id)
          .single()
        profile = profileData
      }
      
      // Buscar itens do pedido
      const { data: items } = await supabaseClient
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
      
      const response = {
        ...order,
        profiles: profile ? [profile] : [],
        order_items: items || []
      }
      
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response(JSON.stringify(orderData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Erro inesperado:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})