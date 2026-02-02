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

    const { event_type, payload } = await req.json()
    console.log(`[trigger-integration] Evento: ${event_type}`);

    // 1. Busca URL do Webhook
    const { data: config } = await supabaseClient
      .from('webhook_configs')
      .select('target_url, is_active')
      .eq('trigger_event', event_type)
      .single();

    if (!config || !config.is_active || !config.target_url) {
      return new Response(JSON.stringify({ message: 'Webhook inativo ou não configurado' }), { headers: corsHeaders });
    }

    let finalPayload = { ...payload, event: event_type, timestamp: new Date().toISOString() };

    // 2. LÓGICA ESPECIAL PARA PEDIDOS (Busca os itens no banco)
    if (event_type === 'order_created' && payload.order_id) {
        console.log(`[trigger-integration] Buscando detalhes completos do pedido #${payload.order_id}`);
        
        // Busca Pedido + Itens + Perfil do Cliente
        const { data: order, error: orderError } = await supabaseClient
            .from('orders')
            .select(`
                *,
                order_items (
                    name_at_purchase,
                    quantity,
                    price_at_purchase
                ),
                profiles (
                    first_name,
                    last_name,
                    phone,
                    cpf_cnpj,
                    email: id -- Vamos pegar o email da auth.users separadamente se precisar, mas aqui é um join simulado
                )
            `)
            .eq('id', payload.order_id)
            .single();

        if (orderError || !order) {
            console.error("Erro ao buscar pedido:", orderError);
            throw new Error("Pedido não encontrado no banco.");
        }

        // Busca o email real na tabela de usuários (opcional, mas bom para garantir)
        const { data: userData } = await supabaseClient.auth.admin.getUserById(order.user_id);
        const userEmail = userData.user?.email || 'email@nao.encontrado';

        // 3. Monta o JSON EXATAMENTE como no seu exemplo CURL
        const formattedItems = order.order_items.map((item: any) => ({
            name: item.name_at_purchase,
            quantity: item.quantity,
            price: item.price_at_purchase
        }));

        finalPayload = {
            event: "order_created",
            timestamp: new Date().toISOString(),
            data: {
                id: order.id,
                total_price: order.total_price,
                status: order.status,
                payment_method: order.payment_method,
                created_at: order.created_at,
                shipping_cost: order.shipping_cost,
                shipping_address: order.shipping_address, // Já está em JSONB no banco
                customer: {
                    id: order.user_id,
                    full_name: `${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim(),
                    phone: order.profiles?.phone || '',
                    email: userEmail,
                    cpf: order.profiles?.cpf_cnpj || ''
                },
                items: formattedItems // AQUI ESTÁ A LISTA DE ITENS!
            }
        };
    }

    // 4. Envia para o N8N
    console.log(`[trigger-integration] Enviando payload para: ${config.target_url}`);
    
    // Log no banco antes de enviar
    await supabaseClient.from('integration_logs').insert({
        event_type: event_type,
        status: 'sending',
        payload: finalPayload,
        details: `Disparando via Edge Function para ${config.target_url}`
    });

    const response = await fetch(config.target_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`N8N Erro ${response.status}: ${errText}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("[trigger-integration] Erro:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})