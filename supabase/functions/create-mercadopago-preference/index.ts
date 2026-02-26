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
    // @ts-ignore
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string;
    // @ts-ignore
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') as string;
    
    // --- AMBIENTE DINÂMICO ---
    // @ts-ignore
    const PROD_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') as string;
    // @ts-ignore
    const TEST_TOKEN = Deno.env.get('mercadopago_test_access_token') as string;

    // Se o token de teste existir, estamos em modo de teste.
    const isTestMode = !!TEST_TOKEN;
    const MERCADOPAGO_ACCESS_TOKEN = isTestMode ? TEST_TOKEN : PROD_TOKEN;

    if (!MERCADOPAGO_ACCESS_TOKEN) {
        throw new Error("Chave de acesso do Mercado Pago não configurada.");
    }
    console.log(`[create-mercadopago-preference] Rodando em modo: ${isTestMode ? 'TESTE' : 'PRODUÇÃO'}`);
    // --- FIM AMBIENTE ---

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
        })
    }

    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      { global: { headers: { 'Authorization': authHeader } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Sessão expirada. Faça login novamente.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { order_id, total_price, origin, shipping_address } = await req.json();

    if (!shipping_address || !order_id || !total_price) {
        return new Response(JSON.stringify({ error: 'Dados do pedido incompletos.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    // --- PAYER DINÂMICO ---
    const phone = (shipping_address.phone || '').replace(/\D/g, '');
    const cpfCnpj = (shipping_address.cpf_cnpj || '').replace(/\D/g, '');

    let payerInfo = {
        first_name: shipping_address.first_name,
        last_name: shipping_address.last_name,
        email: user.email, // Default to user's real email
        phone: {
            area_code: phone.substring(0, 2),
            number: phone.substring(2)
        },
        identification: {
            type: cpfCnpj.length > 11 ? 'CNPJ' : 'CPF',
            number: cpfCnpj
        },
        address: {
            zip_code: (shipping_address.cep || '').replace(/\D/g, ''),
            street_name: shipping_address.street,
            street_number: parseInt(shipping_address.number) || 0
        }
    };

    // If in test mode, override the email to force an approved status.
    if (isTestMode) {
        payerInfo.email = 'test_user_123456_APRO@testuser.com';
    }
    // --- FIM PAYER ---

    const preferencePayload = {
        items: [{
            title: `Pedido #${order_id} - DKCWB ${isTestMode ? '(TESTE)' : ''}`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: Number(total_price),
        }],
        external_reference: order_id.toString(),
        payer: payerInfo,
        back_urls: {
            success: `${origin}/confirmacao-pedido/${order_id}`,
            failure: `${origin}/confirmacao-pedido/${order_id}`,
            pending: `${origin}/confirmacao-pedido/${order_id}`,
        },
        auto_return: "approved",
        notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
        payment_methods: {
            excluded_payment_types: [{ id: "ticket" }]
        }
    };

    console.log(`[create-mercadopago-preference] Enviando payload para Mercado Pago:`, JSON.stringify(preferencePayload, null, 2));

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
        const errorMsg = mpData.message || (mpData.cause && mpData.cause[0] && mpData.cause[0].description) || 'Erro desconhecido no Mercado Pago';
        console.error("Mercado Pago Error:", mpData);
        return new Response(JSON.stringify({ error: `Mercado Pago recusou: ${errorMsg}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: mpResponse.status,
        })
    }

    return new Response(JSON.stringify({
        success: true,
        order_id: order_id,
        init_point: mpData.init_point, 
        sandbox_init_point: mpData.sandbox_init_point
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Internal Function Error:", error);
    return new Response(JSON.stringify({ error: `Erro Interno: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})