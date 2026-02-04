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

    // Segurança: Verificar Header
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

    let responseData;

    // LÓGICA INTELIGENTE:
    // Se o status for "Finalizada", usamos a função RPC do banco que dá os pontos e libera o cartão.
    if (status === 'Finalizada' || status === 'Pago') {
        
        // 1. Atualiza dados de entrega primeiro se fornecidos
        if (delivery_status || tracking_code || delivery_info) {
            const updates: any = {};
            if (delivery_status) updates.delivery_status = delivery_status;
            if (tracking_code) updates.delivery_info = `Rastreio: ${tracking_code}`;
            else if (delivery_info) updates.delivery_info = delivery_info;
            
            await supabaseClient.from('orders').update(updates).eq('id', order_id);
        }

        // 2. Executa a finalização robusta (Pontos + Cartão + Status)
        const { data, error } = await supabaseClient.rpc('finalize_order_payment', { 
            p_order_id: order_id 
        });

        if (error) throw error;
        
        // Retorna o pedido atualizado
        const { data: updatedOrder } = await supabaseClient.from('orders').select('*').eq('id', order_id).single();
        responseData = updatedOrder;

        await supabaseClient.from('integration_logs').insert({
            event_type: 'api_payment_confirmed',
            status: 'success',
            payload: { order_id, method: 'pix_manual' },
            details: `Pedido #${order_id} finalizado via API.`
        });

    } else {
        // ATUALIZAÇÃO PADRÃO (Apenas muda os campos de texto)
        const updates: any = {}
        if (status) updates.status = status
        if (delivery_status) updates.delivery_status = delivery_status
        
        if (tracking_code) {
            updates.delivery_info = `Rastreio: ${tracking_code}`
        } else if (delivery_info) {
            updates.delivery_info = delivery_info
        }

        const { data, error } = await supabaseClient
            .from('orders')
            .update(updates)
            .eq('id', order_id)
            .select()
            .single()

        if (error) throw error;
        responseData = data;

        await supabaseClient.from('integration_logs').insert({
            event_type: 'api_update_order',
            status: 'success',
            payload: { order_id, updates },
            details: `Pedido #${order_id} atualizado via API.`
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

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})