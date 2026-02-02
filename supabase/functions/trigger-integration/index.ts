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
    console.log(`[trigger-integration] Iniciando processamento para evento: ${event_type}`, payload);

    // 1. Busca URL do Webhook
    const { data: config, error: configError } = await supabaseClient
      .from('webhook_configs')
      .select('target_url, is_active')
      .eq('trigger_event', event_type)
      .single();

    if (configError || !config || !config.is_active || !config.target_url) {
      console.warn(`[trigger-integration] Webhook não configurado ou inativo para ${event_type}`);
      return new Response(JSON.stringify({ message: 'Webhook ignorado (inativo/não config)' }), { headers: corsHeaders });
    }

    let finalPayload = { ...payload, event: event_type, timestamp: new Date().toISOString() };

    // 2. LÓGICA PARA PEDIDOS (Busca separada para evitar erro de relacionamento)
    if (event_type === 'order_created' && payload.order_id) {
        
        // A. Busca o Pedido
        const { data: order, error: orderError } = await supabaseClient
            .from('orders')
            .select('*')
            .eq('id', payload.order_id)
            .single();

        if (orderError || !order) {
            throw new Error(`Erro ao buscar pedido: ${orderError?.message || 'Não encontrado'}`);
        }

        // B. Busca os Itens
        const { data: items, error: itemsError } = await supabaseClient
            .from('order_items')
            .select('name_at_purchase, quantity, price_at_purchase')
            .eq('order_id', payload.order_id);

        if (itemsError) {
            console.error("Erro ao buscar itens:", itemsError);
            // Não trava, envia array vazio se falhar
        }

        // C. Busca o Perfil do Cliente
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('first_name, last_name, phone, cpf_cnpj')
            .eq('id', order.user_id)
            .single();

        // D. Busca Email do Auth (Admin)
        const { data: userData } = await supabaseClient.auth.admin.getUserById(order.user_id);
        const userEmail = userData.user?.email || 'email@nao.encontrado';

        // E. Monta o Payload Final
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

    // 3. Envia para o N8N
    console.log(`[trigger-integration] Enviando para: ${config.target_url}`);
    
    // Log Tentativa
    await supabaseClient.from('integration_logs').insert({
        event_type: event_type,
        status: 'sending',
        payload: finalPayload,
        details: `Disparando para ${config.target_url}`
    });

    const response = await fetch(config.target_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
    });

    if (!response.ok) {
        const errText = await response.text();
        // Log Erro do N8N
        await supabaseClient.from('integration_logs').insert({
            event_type: event_type,
            status: 'error',
            payload: finalPayload,
            details: `N8N respondeu com erro ${response.status}: ${errText}`
        });
        throw new Error(`N8N Error ${response.status}: ${errText}`);
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
    
    return new Response(JSON.stringify({ 
        error: error.message,
        stack: error.stack 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500, // Retorna 500 para aparecer vermelho no dashboard, mas com mensagem clara no body
    })
  }
})