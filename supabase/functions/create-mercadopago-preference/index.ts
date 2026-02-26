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
    
    // 1. Tenta pegar o token de teste explícito
    // @ts-ignore
    let token = Deno.env.get('mercadopago_test_access_token') as string;
    
    // 2. Se não tiver, pega o token principal
    if (!token) {
        // @ts-ignore
        token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') as string;
    }

    if (!token) {
        throw new Error("Chave de acesso do Mercado Pago não configurada.");
    }

    // 3. DETECÇÃO INTELIGENTE: Verifica se o token é de teste pelo prefixo
    const isTestToken = token.startsWith('TEST-');
    
    console.log(`[MercadoPago] Token usado inicia com: ${token.substring(0, 5)}... Modo Teste: ${isTestToken}`);

    const authHeader = req.headers.get('Authorization');
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { 'Authorization': authHeader || '' } } });
    
    let userEmail = 'cliente@email.com';
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) userEmail = user.email || userEmail;

    const { order_id, total_price, origin, shipping_address } = await req.json();

    if (!shipping_address || !order_id || !total_price) {
        throw new Error('Dados do pedido incompletos.');
    }

    // Preparação dos dados reais (para Produção)
    const phone = (shipping_address.phone || '').replace(/\D/g, '');
    const cpfCnpj = (shipping_address.cpf_cnpj || '').replace(/\D/g, '');
    const cep = (shipping_address.cep || '').replace(/\D/g, '');
    const streetNum = parseInt(shipping_address.number) || 0;

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
            zip_code: cep,
            street_name: shipping_address.street,
            street_number: streetNum
        }
    };

    // --- LÓGICA DE MODO TESTE ---
    // Se o token for TEST-, FORÇAMOS os dados que o Sandbox exige para não dar erro.
    if (isTestToken) {
        payerInfo = {
            first_name: 'APRO',
            last_name: 'TESTE', // Sobrenome obrigatório para aprovação automática
            email: 'test_user_123456@testuser.com', 
            phone: {
                area_code: '11',
                number: '988888888'
            },
            identification: {
                type: 'CPF',
                number: '12345678909' // CPF válido apenas no sandbox
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
        notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
        binary_mode: true, // Força aprovação ou rejeição instantânea (sem pendente)
        statement_descriptor: "DKCWB"
    };

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferencePayload),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
        console.error("Mercado Pago Error Payload:", JSON.stringify(mpData));
        const errorMsg = mpData.message || 'Erro na criação da preferência';
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