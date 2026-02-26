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

    const isTestMode = !!TEST_TOKEN;
    const MERCADOPAGO_ACCESS_TOKEN = isTestMode ? TEST_TOKEN : PROD_TOKEN;

    if (!MERCADOPAGO_ACCESS_TOKEN) {
        throw new Error("Chave de acesso do Mercado Pago não configurada.");
    }
    
    const authHeader = req.headers.get('Authorization');
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { 'Authorization': authHeader || '' } } });
    
    let userEmail = 'cliente@email.com';
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) userEmail = user.email || userEmail;

    const { order_id, total_price, origin, shipping_address } = await req.json();

    if (!shipping_address || !order_id || !total_price) {
        throw new Error('Dados do pedido incompletos.');
    }

    const phone = (shipping_address.phone || '').replace(/\D/g, '');
    const cpfCnpj = (shipping_address.cpf_cnpj || '').replace(/\D/g, '');

    let payerInfo = {
        first_name: shipping_address.first_name,
        last_name: shipping_address.last_name,
        email: userEmail,
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

    // --- MODO BLINDADO (TESTE) ---
    if (isTestMode) {
        payerInfo = {
            first_name: 'APRO',
            last_name: 'TESTE',
            email: 'test_user_123456@testuser.com', 
            phone: {
                area_code: '11',
                number: '988888888'
            },
            identification: {
                type: 'CPF',
                number: '12345678909'
            },
            address: {
                zip_code: '01001000',
                street_name: 'Rua de Teste Sandbox',
                street_number: 123
            }
        };
    }

    const preferencePayload = {
        items: [{
            title: `Pedido #${order_id} - DKCWB`,
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
        // REMOVIDO: auto_return (deixa o usuário clicar para voltar, evita race conditions)
        // REMOVIDO: payment_methods (deixa o MP decidir o que mostrar)
        notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`
    };

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
        const errorMsg = mpData.message || 'Erro desconhecido no Mercado Pago';
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