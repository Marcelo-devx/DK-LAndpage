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
    
    const MERCADOPAGO_ACCESS_TOKEN = "TEST-1799281998002801-080117-9c18349cb20217961ce8deb967dddb93-1096282589";

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
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
        status: 200,
      })
    }

    const { shipping_address, order_id, total_price, origin } = await req.json()
    
    let cleanedPhone = shipping_address.phone ? shipping_address.phone.replace(/\D/g, '') : '';
    if (cleanedPhone.length < 10) cleanedPhone = '41999999999'; 
    const areaCode = cleanedPhone.substring(0, 2);
    const phoneNumber = cleanedPhone.substring(2);

    const rawNumber = String(shipping_address.number || '');
    const streetNumberStr = rawNumber.replace(/\D/g, ''); 
    const streetNumber = streetNumberStr ? parseInt(streetNumberStr) : 123;

    const payerEmail = `test_user_${Math.floor(Math.random() * 1000000)}@test.com`;

    let identification = { type: 'CPF', number: '19119119100' };
    if (shipping_address.cpf_cnpj) {
        const cleanDoc = shipping_address.cpf_cnpj.replace(/\D/g, '');
        if (cleanDoc.length >= 11) {
            identification = {
                type: cleanDoc.length > 11 ? 'CNPJ' : 'CPF',
                number: cleanDoc
            };
        }
    }

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
            surname: shipping_address.last_name || 'Teste',
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
            identification: identification
        },
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
        return new Response(JSON.stringify({ error: `Mercado Pago recusou: ${errorMsg}`, details: mpData }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
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
    return new Response(JSON.stringify({ error: `Erro Interno: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})