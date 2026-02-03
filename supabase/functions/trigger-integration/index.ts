// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Inicializa cliente com Service Role (Admin) para ignorar RLS
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { event_type, payload } = await req.json()
    console.log(`[trigger-integration] Iniciando... Evento: ${event_type}, Payload:`, JSON.stringify(payload));

    // 1. Validar Configuração do Webhook
    const { data: config, error: configError } = await supabaseClient
      .from('webhook_configs')
      .select('target_url, is_active')
      .eq('trigger_event', event_type)
      .maybeSingle(); 

    if (configError) {
        console.error("Erro ao buscar config do webhook:", configError);
        return new Response(JSON.stringify({ error: 'Erro ao ler configurações.' }), { headers: corsHeaders, status: 500 });
    }

    if (!config || !config.is_active || !config.target_url) {
      console.warn(`Webhook ignorado: Nenhuma URL ativa configurada para o evento '${event_type}'.`);
      return new Response(JSON.stringify({ message: 'Webhook ignorado (inativo).' }), { headers: corsHeaders, status: 200 });
    }

    let finalPayload = { ...payload, event: event_type, timestamp: new Date().toISOString() };

    // 2. ENRIQUECIMENTO DE DADOS (Apenas para Pedidos)
    if (event_type === 'order_created' && payload.order_id) {
        try {
            // A. Buscar Pedido
            const { data: order, error: orderError } = await supabaseClient
                .from('orders')
                .select('*')
                .eq('id', payload.order_id)
                .single();

            if (orderError || !order) throw new Error(`Pedido ${payload.order_id} não encontrado.`);

            // B. Buscar Itens
            const { data: items } = await supabaseClient
                .from('order_items')
                .select('name_at_purchase, quantity, price_at_purchase')
                .eq('order_id', payload.order_id);

            // C. Buscar Perfil
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('first_name, last_name, phone, cpf_cnpj')
                .eq('id', order.user_id)
                .single();

            // D. Buscar Email
            let userEmail = 'nao_identificado@loja.com';
            try {
                const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(order.user_id);
                if (!userError && userData?.user?.email) {
                    userEmail = userData.user.email;
                }
            } catch (err) {
                console.warn("Não foi possível recuperar e-mail do usuário:", err);
            }

            const formattedItems = (items || []).map((item: any) => ({
                name: item.name_at_purchase,
                quantity: item.quantity,
                price: item.price_at_purchase
            }));

            // CÁLCULO CORRIGIDO DO TOTAL
            // order.total_price no banco = Produtos - Descontos
            // order.shipping_cost no banco = Frete
            // Total Real = (Produtos - Descontos) + Frete
            const productsSubtotal = Number(order.total_price || 0);
            const shippingCost = Number(order.shipping_cost || 0);
            const grandTotal = productsSubtotal + shippingCost;

            finalPayload = {
                event: "order_created",
                timestamp: new Date().toISOString(),
                data: {
                    id: order.id,
                    total_price: grandTotal, // Soma final (O que o cliente paga)
                    subtotal: productsSubtotal, // Valor apenas dos produtos (com desconto aplicado)
                    status: order.status,
                    payment_method: order.payment_method,
                    created_at: order.created_at,
                    shipping_cost: shippingCost,
                    coupon_discount: Number(order.coupon_discount || 0), // Informa o desconto separadamente também
                    shipping_address: order.shipping_address,
                    customer: {
                        id: order.user_id,
                        full_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Cliente',
                        phone: profile?.phone || '',
                        email: userEmail,
                        cpf: profile?.cpf_cnpj || ''
                    },
                    items: formattedItems
                }
            };
        } catch (enrichError) {
            console.error("Erro ao enriquecer dados do pedido:", enrichError);
            finalPayload.error = "Falha parcial ao buscar detalhes do pedido";
        }
    }

    // 3. Registrar Log
    await supabaseClient.from('integration_logs').insert({
        event_type: event_type,
        status: 'sending',
        payload: finalPayload,
        details: `Enviando para ${config.target_url}`
    });

    // 4. Enviar para N8N
    const response = await fetch(config.target_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
    });

    if (!response.ok) {
        const responseText = await response.text();
        await supabaseClient.from('integration_logs').insert({
            event_type: event_type,
            status: 'error',
            payload: finalPayload,
            details: `Erro N8N (${response.status}): ${responseText.substring(0, 500)}`
        });
        
        throw new Error(`O N8N retornou erro ${response.status}: ${responseText}`);
    }

    await supabaseClient.from('integration_logs').insert({
        event_type: event_type,
        status: 'success',
        payload: finalPayload,
        details: 'Envio concluído com sucesso (200 OK)'
    });

    return new Response(JSON.stringify({ success: true, message: "Integrado com sucesso" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("ERRO CRÍTICO NA EDGE FUNCTION:", error);
    return new Response(JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro desconhecido',
        stack: error.stack
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})