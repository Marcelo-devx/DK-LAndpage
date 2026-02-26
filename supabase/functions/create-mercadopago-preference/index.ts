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
    
    // --- CHAVE FORÇADA PARA DEBUG (Remova isso ao ir para produção) ---
    const HARDCODED_TOKEN = "TEST-1799281998002801-080117-9c18349cb20217961ce8deb967dddb93-1096282589";
    
    // @ts-ignore
    const envToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    
    // Prioridade: Hardcoded > Env Var
    const token = HARDCODED_TOKEN || envToken;

    if (!token) {
        throw new Error("Nenhuma chave do Mercado Pago encontrada.");
    }

    // Limpeza e Detecção
    const cleanToken = token.trim();
    const isTestToken = cleanToken.startsWith('TEST-');
    
    console.log(`[MercadoPago] Usando token (final): ${cleanToken.substring(0, 10)}...`);
    console.log(`[MercadoPago] Modo Sandbox Ativo: ${isTestToken}`);

    const authHeader = req.headers.get('Authorization');
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { 'Authorization': authHeader || '' } } });
    
    let userEmail = 'cliente@email.com';
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) userEmail = user.email || userEmail;

    const { order_id, total_price, origin, shipping_address } = await req.json();

    if (!shipping_address || !order_id || !total_price) {
        throw new Error('Dados do pedido incompletos.');
    }

    // Configuração do Payer (Pagador)
    let payerInfo;

    if (isTestToken) {
        // MODO SANDBOX: Usamos dados fictícios aceitos pelo MP para evitar rejeição de validação
        console.log("[MercadoPago] Configurando Payer com dados de TESTE (Mock)");
        payerInfo = {
            name: "Test",
            surname: "User",
            email: "test_user_123456@testuser.com", // Email especial que o MP aceita sempre
            phone: {
                area_code: "11",
                number: "988888888"
            },
            identification: {
                type: "CPF",
                number: "19119119100" // CPF válido de teste
            },
            address: {
                zip_code: "01001000",
                street_name: "Rua de Teste",
                street_number: 123
            }
        };
    } else {
        // MODO PRODUÇÃO: Usamos os dados reais do formulário
        console.log("[MercadoPago] Configurando Payer com dados REAIS");
        const phone = (shipping_address.phone || '').replace(/\D/g, '');
        const cpfCnpj = (shipping_address.cpf_cnpj || '').replace(/\D/g, '');
        
        payerInfo = {
            name: shipping_address.first_name,
            surname: shipping_address.last_name,
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
    }

    const preferencePayload = {
        items: [{
            id: order_id.toString(),
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
        auto_return: "approved",
        notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
        statement_descriptor: "DKCWB"
    };

    console.log("[MercadoPago] Enviando Payload de Preferência...");

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferencePayload),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
        console.error("Mercado Pago Response ERROR:", JSON.stringify(mpData));
        const errorMsg = mpData.message || 'Erro desconhecido do Mercado Pago';
        return new Response(JSON.stringify({ error: `Mercado Pago recusou: ${errorMsg}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: mpResponse.status, // Retorna o status real (400, 401, etc)
        })
    }

    console.log("[MercadoPago] Sucesso! Init Point:", mpData.init_point);

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
    console.error("[CreatePreference] Erro Fatal:", error);
    return new Response(JSON.stringify({ error: `Erro Interno: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})