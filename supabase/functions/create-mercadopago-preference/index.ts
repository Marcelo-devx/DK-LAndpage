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

    // 1. Telefone: Garante formato limpo
    let cleanedPhone = shipping_address.phone ? shipping_address.phone.replace(/\D/g, '') : '';
    if (cleanedPhone.length < 10) {
       console.warn(`[MP] Telefone inválido (${cleanedPhone}), usando fallback.`);
       cleanedPhone = '41999999999'; 
    }
    const areaCode = cleanedPhone.substring(0, 2);
    const phoneNumber = cleanedPhone.substring(2);

    // 2. Número da Rua: Mercado Pago exige Inteiro. 
    // Se o usuário digitou "123B" ou "S/N", extraímos apenas os números ou usamos 0.
    let streetNumberRaw = shipping_address.number ? shipping_address.number.replace(/\D/g, '') : '';
    let streetNumber = parseInt(streetNumberRaw);
    if (isNaN(streetNumber)) streetNumber = 0;

    // 3. E-mail: Evita erro de "payer email equals collector email" no modo sandbox
    const isTestMode = MERCADOPAGO_ACCESS_TOKEN.startsWith('TEST-');
    // Se for teste, geramos um email aleatório. Se for produção, usamos o email real.
    const payerEmail = isTestMode 
        ? `test_user_${order_id}_${Math.floor(Math.random() * 1000)}@test.com` 
        : (user.email || 'cliente@dkcwb.com');

    // 4. Payload da Preferência
    const preferencePayload = {
        items: [{
            title: `Pedido #${order_id} - DKCWB`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: Number(total_price),
        }],
        external_reference: order_id.toString(),
        payer: {
            name: shipping_address.first_name || 'Cliente',
            surname: shipping_address.last_name || 'DK',
            email: payerEmail,
            phone: {
                area_code: areaCode,
                number: phoneNumber,
            },
            address: {
                zip_code: shipping_address.cep ? shipping_address.cep.replace(/\D/g, '') : '80000000',
                street_name: shipping_address.street || 'Rua',
                street_number: streetNumber,
            },
        },
        back_urls: {
            success: `${frontUrl}/confirmacao-pedido/${order_id}?collection_status=approved`,
            failure: `${frontUrl}/confirmacao-pedido/${order_id}?collection_status=failure`,
            pending: `${frontUrl}/confirmacao-pedido/${order_id}?collection_status=pending`,
        },
        auto_return: "approved",
        notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
        statement_descriptor: "DKCWB STORE",
    };

    console.log("[MP] Criando preferência:", JSON.stringify(preferencePayload));

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
        
        // Tenta extrair a causa específica para ajudar no debug
        if (mpData.cause && Array.isArray(mpData.cause) && mpData.cause.length > 0) {
            // Traduz erros comuns
            const cause = mpData.cause[0];
            if (cause.code === 120) errorMessage = "Aguarde um momento e tente novamente (Erro de Sessão MP).";
            else if (cause.description.includes("zip_code")) errorMessage = "CEP inválido para o Mercado Pago.";
            else if (cause.description.includes("street_number")) errorMessage = "Número do endereço inválido.";
            else errorMessage = `MP: ${cause.description}`;
        }

        // Retorna 200 mas com campo error, para o frontend exibir o toast bonito
        return new Response(JSON.stringify({ error: errorMessage }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }

    return new Response(JSON.stringify({
        order_id: order_id,
        init_point: mpData.init_point, // Link para pagamento
        sandbox_init_point: mpData.sandbox_init_point
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("[MP] Erro Interno:", error);
    // Retorna 200 com erro
    return new Response(JSON.stringify({ error: `Erro interno: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})