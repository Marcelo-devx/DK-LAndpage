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
    // @ts-ignore
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string;
    // @ts-ignore
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') as string;
    
    // Token de TESTE (Produção deve usar variável de ambiente)
    const MERCADOPAGO_ACCESS_TOKEN = "TEST-1799281998002801-080117-9c18349cb20217961ce8deb967dddb93-1096282589";

    if (!MERCADOPAGO_ACCESS_TOKEN) {
        throw new Error('Token do Mercado Pago não configurado.');
    }
    
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      { global: { headers: { 'Authorization': req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      // Retorna 200 com erro para o front tratar
      return new Response(JSON.stringify({ error: 'Sessão expirada. Faça login novamente.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, 
      })
    }

    const { shipping_address, order_id, total_price, origin } = await req.json()
    
    // Validação básica
    if (!total_price || total_price <= 0) {
        return new Response(JSON.stringify({ error: 'Valor do pedido inválido.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }

    // URL de retorno (Frontend)
    const frontUrl = origin || 'https://dkcwb.com';

    // --- FORMATAÇÃO DE DADOS PARA O MP ---

    // 1. E-mail: Evita erro de "payer email equals collector email" no modo sandbox
    const isTestMode = MERCADOPAGO_ACCESS_TOKEN.startsWith('TEST-');
    // Se for teste, geramos um email aleatório para simular um comprador diferente do vendedor
    const payerEmail = isTestMode 
        ? `test_user_${order_id}_${Math.floor(Math.random() * 1000)}@test.com` 
        : (user.email || 'cliente@dkcwb.com');

    // 2. Payload da Preferência SIMPLIFICADO
    // Removemos address e phone do payer para evitar erros de validação estrita do MP
    // O Checkout Pro pedirá os dados necessários ao usuário se faltar algo crítico para o pagamento
    const preferencePayload = {
        items: [{
            title: `Pedido #${order_id}`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: Number(Number(total_price).toFixed(2)), // Garante 2 casas decimais
        }],
        external_reference: order_id.toString(),
        payer: {
            name: shipping_address.first_name || 'Cliente',
            surname: shipping_address.last_name || 'DK',
            email: payerEmail,
        },
        back_urls: {
            success: `${frontUrl}/confirmacao-pedido/${order_id}?collection_status=approved`,
            failure: `${frontUrl}/confirmacao-pedido/${order_id}?collection_status=failure`,
            pending: `${frontUrl}/confirmacao-pedido/${order_id}?collection_status=pending`,
        },
        auto_return: "approved",
        notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
        statement_descriptor: "DKCWB",
        binary_mode: true // Força aprovação instantânea ou rejeição (sem status pendente prolongado)
    };

    console.log("[MP] Criando preferência (Payload Limpo):", JSON.stringify(preferencePayload));

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferencePayload),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
        console.error("[MP] API Error:", JSON.stringify(mpData));
        
        let errorMessage = mpData.message || 'Erro no Mercado Pago';
        
        if (mpData.cause && Array.isArray(mpData.cause) && mpData.cause.length > 0) {
            const cause = mpData.cause[0];
            errorMessage = `MP: ${cause.description}`;
        }

        return new Response(JSON.stringify({ error: errorMessage }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }

    return new Response(JSON.stringify({
        order_id: order_id,
        init_point: mpData.init_point, 
        sandbox_init_point: mpData.sandbox_init_point
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("[MP] Erro Interno:", error);
    return new Response(JSON.stringify({ error: `Erro interno: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})