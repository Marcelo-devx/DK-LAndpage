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

    const { event_type, payload, simulate } = await req.json()
    console.log(`[trigger-integration] Processando evento: ${event_type} (Simulação: ${!!simulate})`);

    // 1. Buscar URL do N8N no Banco
    const { data: config, error: configError } = await supabaseClient
      .from('webhook_configs')
      .select('target_url, is_active')
      .eq('trigger_event', event_type)
      .maybeSingle();

    if (configError) {
        return new Response(JSON.stringify({ success: false, error: 'Erro ao buscar configuração no banco.' }), { headers: corsHeaders, status: 200 });
    }

    if (!config || !config.is_active || !config.target_url) {
      return new Response(JSON.stringify({ success: false, error: 'Webhook inativo ou URL não configurada.' }), { headers: corsHeaders, status: 200 });
    }

    // Sanitização básica da URL
    let targetUrl = config.target_url.trim();
    if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://' + targetUrl;
    }

    let finalPayload = { ...payload, event: event_type, timestamp: new Date().toISOString() };

    // --- MODO SIMULAÇÃO (TESTE DO ADMIN) ---
    if (simulate) {
        if (event_type === 'order_created') {
            finalPayload = {
                event: "order_created",
                timestamp: new Date().toISOString(),
                is_simulation: true,
                data: {
                    id: 999999,
                    total_price: 150.00,
                    subtotal_products: 140.00,
                    discount_applied: 10.00,
                    shipping_cost: 20.00,
                    donation_amount: 5.00,
                    status: "Aguardando Pagamento",
                    payment_method: "PIX via WhatsApp",
                    created_at: new Date().toISOString(),
                    coupon_name: "BOASVINDAS",
                    benefits_used: "Nível Ouro: Frete Grátis",
                    customer: {
                        id: "user-uuid-teste",
                        full_name: "Cliente Teste da Silva",
                        phone: "41999999999",
                        email: "teste@dkcwb.com",
                        cpf: "000.000.000-00"
                    },
                    shipping_address: {
                        street: "Rua Exemplo",
                        number: "1000",
                        neighborhood: "Centro",
                        city: "Curitiba",
                        state: "PR",
                        cep: "80000-000",
                        complement: "Apto 101"
                    },
                    items: [
                        {
                            name: "Produto Exemplo Premium",
                            quantity: 1,
                            price: 100.00,
                            total: 100.00,
                            image: "https://placehold.co/400",
                            type: "product"
                        }
                    ]
                }
            };
        }
    } 
    // --- MODO REAL ---
    else if (event_type === 'order_created' && payload.order_id) {
        // ... (Lógica de enriquecimento existente mantida)
        try {
            const { data: order } = await supabaseClient.from('orders').select('*').eq('id', payload.order_id).single();
            if (order) {
                const { data: items } = await supabaseClient.from('order_items').select('*').eq('order_id', payload.order_id);
                const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', order.user_id).single();
                
                let userEmail = 'nao_informado@sistema.com';
                try {
                    const { data: authUser } = await supabaseClient.auth.admin.getUserById(order.user_id);
                    if (authUser?.user?.email) userEmail = authUser.user.email;
                } catch (e) {}

                const formattedItems = (items || []).map((item: any) => ({
                    name: item.name_at_purchase,
                    quantity: item.quantity,
                    price: item.price_at_purchase,
                    total: item.price_at_purchase * item.quantity,
                    image: item.image_url_at_purchase,
                    type: item.item_type
                }));

                // Cálculos
                const dbTotalPrice = Number(order.total_price || 0);
                const discount = Number(order.coupon_discount || 0);
                const shipping = Number(order.shipping_cost || 0);
                const donation = Number(order.donation_amount || 0);
                const subtotal = dbTotalPrice + discount;
                const finalTotal = dbTotalPrice + shipping + donation;

                const { data: userCoupon } = await supabaseClient.from('user_coupons').select('coupons(name)').eq('order_id', payload.order_id).maybeSingle();

                finalPayload = {
                    event: "order_created",
                    timestamp: new Date().toISOString(),
                    data: {
                        id: order.id,
                        total_price: finalTotal,
                        subtotal_products: subtotal,
                        discount_applied: discount,
                        shipping_cost: shipping,
                        donation_amount: donation,
                        payment_method: order.payment_method,
                        status: order.status,
                        created_at: order.created_at,
                        coupon_name: userCoupon?.coupons?.name || null,
                        benefits_used: order.benefits_used,
                        customer: {
                            id: order.user_id,
                            full_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Cliente',
                            phone: profile?.phone || order.shipping_address?.phone || '',
                            email: userEmail,
                            cpf: profile?.cpf_cnpj || ''
                        },
                        shipping_address: order.shipping_address,
                        items: formattedItems
                    }
                };
            }
        } catch (e) {
            console.error("Erro enriquecimento:", e);
            finalPayload.enrichment_error = e.message;
        }
    }

    // 3. Disparo para N8N (Com tratamento de erro robusto)
    console.log(`Enviando para N8N: ${targetUrl}`);
    
    let response;
    let responseText;

    try {
        response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalPayload)
        });
        responseText = await response.text();
    } catch (fetchError) {
        // Erro de rede (DNS, Timeout, etc)
        const errorMsg = `Falha de conexão com N8N: ${fetchError.message}`;
        console.error(errorMsg);
        
        // Logar erro
        if (!simulate) {
            await supabaseClient.from('integration_logs').insert({
                event_type: event_type,
                status: 'error',
                payload: finalPayload,
                response_code: 0,
                details: errorMsg
            });
        }

        return new Response(JSON.stringify({ success: false, error: errorMsg }), { headers: corsHeaders, status: 200 });
    }

    // Logar resposta do N8N
    if (!simulate || !response.ok) {
        await supabaseClient.from('integration_logs').insert({
            event_type: event_type,
            status: response.ok ? 'success' : 'error',
            payload: finalPayload,
            response_code: response.status,
            details: response.ok ? 'Sucesso (Simulação)' : `Erro N8N (${response.status}): ${responseText.slice(0, 200)}`
        });
    }

    if (!response.ok) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: `O N8N retornou erro ${response.status}. Verifique a URL e se o Workflow está ativo.` 
        }), { headers: corsHeaders, status: 200 });
    }

    return new Response(JSON.stringify({ success: true, message: 'Dados enviados ao N8N com sucesso.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("[trigger-integration] Erro Fatal:", error);
    return new Response(JSON.stringify({ success: false, error: `Erro interno: ${error.message}` }), { headers: corsHeaders, status: 200 });
  }
})