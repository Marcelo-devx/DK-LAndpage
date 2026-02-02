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
    console.log(`[trigger-integration] Evento: ${event_type}, Order ID: ${payload.order_id}`);

    // 1. Validar Configuração do Webhook
    const { data: config } = await supabaseClient
      .from('webhook_configs')
      .select('target_url, is_active')
      .eq('trigger_event', event_type)
      .single();

    if (!config || !config.is_active || !config.target_url) {
      return new Response(JSON.stringify({ message: 'Webhook ignorado.' }), { headers: corsHeaders });
    }

    let finalPayload = { ...payload, event: event_type, timestamp: new Date().toISOString() };

    // 2. BUSCAR DADOS (Modo Seguro: Consultas Separadas)
    if (event_type === 'order_created' && payload.order_id) {
        
        // A. Buscar Pedido
        const { data: order, error: orderError } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('id', payload.order_id)
            .single();

        if (orderError || !order) throw new Error(`Pedido não encontrado: ${orderError?.message}`);

        // B. Buscar Itens do Pedido (Query Separada)
        const { data: items, error: itemsError } = await supabaseClient
            .from('order_items')
            .select('name_at_purchase, quantity, price_at_purchase')
            .eq('order_id', payload.order_id);

        if (itemsError) console.error("Erro ao buscar itens:", itemsError);

        // C. Buscar Perfil do Cliente (Query Separada)
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('first_name, last_name, phone, cpf_cnpj')
            .eq('id', order.user_id)
            .single();

        // D. Buscar Email do Auth (Admin API)
        const { data: userData } = await supabaseClient.auth.admin.getUserById(order.user_id);
        const userEmail = userData.user?.email || 'email@nao.disponivel';

        // E. Montar Payload Final
        const formattedItems = (items || []).map((item: any) => ({
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
    }

    // 3. Enviar para o N8N
    console.log(`[trigger-integration] Disparando para: ${config.target_url}`);
    
    // Log Tentativa no Banco
    await supabaseClient.from('integration_logs').insert({
        event_type: event_type,
        status: 'sending',
        payload: finalPayload,
        details: `Enviando para ${config.target_url}`
    });

    const response = await fetch(config.target_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
    });

    if (!response.ok) {
        const errText = await response.text();
        await supabaseClient.from('integration_logs').insert({
            event_type: event_type,
            status: 'error',
            payload: finalPayload,
            details: `Erro N8N ${response.status}: ${errText}`
        });
        throw new Error(`N8N respondeu com erro ${response.status}`);
    }

    // Log Sucesso
    await supabaseClient.from('integration_logs').insert({
        event_type: event_type,
        status: 'success',
        payload: finalPayload,
        details: `Sucesso 200 OK`
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("[trigger-integration] ERRO FATAL:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})