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
    // Inicializa cliente com Service Role (Admin) para ignorar RLS e acessar configurações
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { event_type, payload } = await req.json()
    console.log(`[trigger-integration] Processando evento: ${event_type}`, JSON.stringify(payload));

    // 1. Validar Configuração do Webhook no Banco
    const { data: config, error: configError } = await supabaseClient
      .from('webhook_configs')
      .select('target_url, is_active')
      .eq('trigger_event', event_type)
      .maybeSingle(); 

    if (configError) {
        console.error("Erro ao buscar config do webhook:", configError);
        return new Response(JSON.stringify({ error: 'Erro de configuração no banco de dados.' }), { headers: corsHeaders, status: 500 });
    }

    if (!config || !config.is_active || !config.target_url) {
      console.warn(`Webhook ignorado: Nenhuma URL ativa para '${event_type}'.`);
      return new Response(JSON.stringify({ message: 'Webhook inativo ou não configurado.' }), { headers: corsHeaders, status: 200 });
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
                .select('name_at_purchase, quantity, price_at_purchase, image_url_at_purchase')
                .eq('order_id', payload.order_id);

            // C. Buscar Perfil do Cliente
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('first_name, last_name, phone, cpf_cnpj, email:id') // email might not be directly here if auth managed differently, trying ID fallback
                .eq('id', order.user_id)
                .single();

            // Tenta pegar email real do Auth Admin se possível (mais confiável)
            let userEmail = 'pendente@sistema.com';
            try {
                const { data: userData } = await supabaseClient.auth.admin.getUserById(order.user_id);
                if (userData?.user?.email) userEmail = userData.user.email;
            } catch (e) {
                console.log("Não foi possível buscar email via Auth Admin (usando fallback).");
            }

            // D. Buscar Nome do Cupom
            const { data: userCoupon } = await supabaseClient
                .from('user_coupons')
                .select('coupons(name)')
                .eq('order_id', payload.order_id)
                .maybeSingle();

            const couponName = userCoupon?.coupons?.name || null;

            // Formatação dos Itens
            const formattedItems = (items || []).map((item: any) => ({
                name: item.name_at_purchase,
                quantity: item.quantity,
                price: item.price_at_purchase,
                image: item.image_url_at_purchase
            }));

            // CÁLCULO FINANCEIRO COMPLETO
            // order.total_price (Banco) = Subtotal dos Produtos - Desconto
            const dbTotalPrice = Number(order.total_price || 0); 
            const discountValue = Number(order.coupon_discount || 0);
            const shippingValue = Number(order.shipping_cost || 0);
            const donationValue = Number(order.donation_amount || 0); // NOVO CAMPO
            
            // Valor original dos produtos (sem desconto)
            const productsSubtotal = dbTotalPrice + discountValue;
            
            // Valor FINAL que o cliente paga (Produtos c/ desconto + Frete + Doação)
            const finalTotalToPay = dbTotalPrice + shippingValue + donationValue;

            finalPayload = {
                event: "order_created",
                timestamp: new Date().toISOString(),
                data: {
                    id: order.id,
                    // Dados Financeiros
                    total_price: finalTotalToPay,
                    subtotal_products: productsSubtotal,
                    discount: discountValue,
                    shipping_cost: shippingValue,
                    donation_amount: donationValue,
                    
                    // Metadados
                    status: order.status,
                    payment_method: order.payment_method,
                    created_at: order.created_at,
                    coupon_name: couponName,
                    benefits_used: order.benefits_used,
                    
                    // Cliente
                    customer: {
                        id: order.user_id,
                        full_name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'Cliente',
                        phone: profile?.phone || order.shipping_address?.phone || '',
                        email: userEmail,
                        cpf: profile?.cpf_cnpj || ''
                    },
                    
                    // Endereço
                    shipping_address: order.shipping_address,
                    
                    // Itens
                    items: formattedItems
                }
            };
        } catch (enrichError) {
            console.error("Erro ao enriquecer dados do pedido:", enrichError);
            finalPayload.error = "Falha ao coletar detalhes completos do pedido.";
        }
    }

    // 3. Registrar Log de Envio
    await supabaseClient.from('integration_logs').insert({
        event_type: event_type,
        status: 'sending',
        payload: finalPayload,
        details: `Enviando para ${config.target_url}`
    });

    // 4. Disparar para N8N
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
            details: `Erro N8N (${response.status}): ${responseText.slice(0, 200)}`
        });
        throw new Error(`N8N Error ${response.status}: ${responseText}`);
    }

    // Log de Sucesso
    await supabaseClient.from('integration_logs').insert({
        event_type: event_type,
        status: 'success',
        payload: { success: true, n8n_status: response.status },
        details: 'Enviado com sucesso para N8N'
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})