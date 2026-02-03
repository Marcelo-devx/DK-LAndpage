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
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Segurança: Verificar se a requisição tem a chave secreta (Service Role)
    // O N8N deve enviar no Header: Authorization: Bearer SUA_SERVICE_ROLE_KEY
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.includes('Bearer')) {
        return new Response(JSON.stringify({ error: 'Acesso negado. Requer Service Role Key.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    const { order_id, status, delivery_status, tracking_code, delivery_info } = await req.json()

    if (!order_id) {
        return new Response(JSON.stringify({ error: 'order_id é obrigatório.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    // Montar objeto de atualização dinâmico
    const updates: any = {}
    if (status) updates.status = status
    if (delivery_status) updates.delivery_status = delivery_status
    
    // Se enviar tracking_code ou delivery_info, atualizamos o campo delivery_info no banco
    // Assumindo que delivery_info no banco é um texto ou JSON. No seu schema é TEXT.
    if (tracking_code) {
        updates.delivery_info = `Rastreio: ${tracking_code}`
    } else if (delivery_info) {
        updates.delivery_info = delivery_info
    }

    // Executar atualização
    const { data, error } = await supabaseClient
        .from('orders')
        .update(updates)
        .eq('id', order_id)
        .select()
        .single()

    if (error) {
        throw error
    }

    // Registrar no Log de Integração (Opcional, mas bom para debug)
    await supabaseClient.from('integration_logs').insert({
        event_type: 'api_update_order',
        status: 'success',
        payload: { order_id, updates },
        details: `Pedido #${order_id} atualizado via API externa.`
    })

    return new Response(JSON.stringify({ 
        success: true, 
        message: 'Pedido atualizado com sucesso.',
        data 
    }), {
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