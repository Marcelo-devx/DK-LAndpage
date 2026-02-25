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
    
    // --- MODO SANDBOX ATIVO ---
    const MERCADOPAGO_ACCESS_TOKEN = "TEST-1799281998002801-080117-9c18349cb20217961ce8deb967dddb93-1096282589";

    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: { 'Authorization': req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { shipping_address, order_id, total_price, origin } = await req.json()
    
    // URL de retorno (Frontend)
    const frontUrl = origin || 'https://dkcwb.com';

    // Telefone
    let cleanedPhone = shipping_address.phone ? shipping_address.phone.replace(/\D/g, '') : '';
    if (cleanedPhone.length < 10) cleanedPhone = '41999999999'; 
    const areaCode = cleanedPhone.substring(0, 2);
    const phoneNumber = cleanedPhone.substring(2);

    // --- CRUCIAL PARA SANDBOX ---
    // Mercado Pago proíbe que o Vendedor e o Comprador tenham o mesmo e-mail.
    // Como estamos usando a chave TEST, geramos um e-mail aleatório para o "pagador"
    // para garantir que a tela de cartão abra sem erro.
    const payerEmail = `test_user_${Math.floor(Math.random() * 1000000)}@test.com`;

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
                street_number: Number(shipping_address.number) || 0,
            },
        },
        back_urls: {
            success: `${frontUrl}/confirmacao-pedido/${order_id}`,
            failure: `${frontUrl}/confirmacao-pedido/${order_id}`,
            pending: `${frontUrl}/confirmacao-pedido/${order_id}`,
        },
        auto_return: "approved",
        notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
        payment_methods: {
            excluded_payment_types: [{ id: "ticket" }]
        }
    };

    console.log("[create-mercadopago-preference] Payload:", JSON.stringify(preferencePayload));

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
        console.error("[create-mercadopago-preference] MP Error:", mpData);
        return new Response(JSON.stringify({ error: mpData.message || 'Erro ao criar preferência MP' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }

    return new Response(JSON.stringify({
        order_id: order_id,
        init_point: mpData.init_point, 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("[create-mercadopago-preference] Global Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})