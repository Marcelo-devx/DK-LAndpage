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
    console.log(`[trigger-integration] Iniciando processamento: ${event_type}`);

    // 1. Buscar URL do N8N no Banco
    const { data: config, error: configError } = await supabaseClient
      .from('webhook_configs')
      .select('target_url, is_active')
      .eq('trigger_event', event_type)
      .maybeSingle();

    if (configError) {
        console.error("[trigger-integration] Erro ao buscar configuração:", configError);
        return new Response(JSON.stringify({ error: 'Configuração não encontrada.' }), { headers: corsHeaders, status: 500 });
    }

    if (!config || !config.is_active || !config.target_url) {
      console.warn(`[trigger-integration] Webhook inativo ou não configurado para: ${event_type}`);
      return new Response(JSON.stringify({ message: 'Webhook inativo.' }), { headers: corsHeaders, status: 200 });
    }

    console.log(`[trigger-integration] Enviando para: ${config.target_url}`);

    let finalPayload = { ...payload, event: event_type, timestamp: new Date().toISOString() };

    // 2. ENRIQUECIMENTO DE DADOS (Pedido Completo)
    if (event_type === 'order_created' && payload.order_id) {
        try {
            const { data: order } = await supabaseClient.from('orders').select('*').eq('id', payload.order_id).single();
            if (!order) throw new Error("Pedido não encontrado");

            const { data: items } = await supabaseClient.from('order_items').select('*').eq('order_id', payload.order_id);
            const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', order.user_id).single();
            
            // Tentar obter email
            let userEmail = 'nao_informado@sistema.com';
            const { data: authUser } = await supabaseClient.auth.admin.getUserById(order.user_id);
            if (authUser?.user?.email) userEmail = authUser.user.email;

            // Formatar Itens
            const formattedItems = (items || []).map((item: any) => ({
                name: item.name_at_purchase,
                quantity: item.quantity,
                price: item.price_at_purchase,
                total: item.price_at_purchase * item.quantity,
                image: item.image_url_at_purchase,
                type: item.item_type
            }));

            // Cálculos
            const dbTotalPrice = Number(order.total_price || 0); // Produtos - Desconto
            const discount = Number(order.coupon_discount || 0);
            const shipping = Number(order.shipping_cost || 0);
            const donation = Number(order.donation_amount || 0);
            
            const subtotal = dbTotalPrice + discount;
            const finalTotal = dbTotalPrice + shipping + donation;

            finalPayload = {
                event: "order_created",
                timestamp: new Date().toISOString(),
                order_id: order.id,
                
                // Dados Financeiros
                financial: {
                    total_paid: finalTotal,
                    subtotal_products: subtotal,
                    discount_applied: discount,
                    shipping_cost: shipping,
                    donation_amount: donation,
                    payment_method: order.payment_method,
                    status: order.status
                },

                // Cliente
                customer: {
                    id: order.user_id,
                    name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Cliente',
                    email: userEmail,
                    phone: profile?.phone || order.shipping_address?.phone || '',
                    cpf: profile?.cpf_cnpj || ''
                },

                // Entrega
                shipping: order.shipping_address,

                // Metadados
                meta: {
                    coupon_used: order.coupon_discount > 0,
                    benefits_used: order.benefits_used || 'Nenhum',
                    created_at: order.created_at
                },

                // Itens
                items: formattedItems
            };

        } catch (e) {
            console.error("[trigger-integration] Erro ao enriquecer dados:", e);
            finalPayload.enrichment_error = e.message;
        }
    }

    // 3. Disparo para N8N
    const response = await fetch(config.target_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
    });

    const responseText = await response.text();
    console.log(`[trigger-integration] Resposta N8N (${response.status}):`, responseText.slice(0, 100));

    // Log no Banco
    await supabaseClient.from('integration_logs').insert({
        event_type: event_type,
        status: response.ok ? 'success' : 'error',
        payload: finalPayload,
        response_code: response.status,
        details: response.ok ? 'Sucesso' : `Erro N8N: ${responseText.slice(0, 200)}`
    });

    return new Response(JSON.stringify({ success: response.ok, n8n_status: response.status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("[trigger-integration] Erro Fatal:", error);
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
  }
})