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
    return new Response(null, { headers: corsHeaders })
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

    // Usa Service Role para garantir acesso a todos os dados se necessário
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Busca o pedido com os perfis e itens relacionados
    // Agora funcionará graças à correção do relacionamento
    const { data, error } = await supabaseClient
      .from('orders')
      .select(`
        *,
        profiles (
          first_name,
          last_name,
          email: id, 
          phone,
          cpf_cnpj
        ),
        order_items (*)
      `)
      .eq('id', orderId)
      .single()

    if (error) {
      console.error("Erro ao buscar pedido:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Formatação extra se necessário (ex: pegar email real de auth se profiles não tiver)
    // Opcional: Buscar email da tabela auth se precisar, mas profiles deve ter dados suficientes

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})