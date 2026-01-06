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
    // @ts-ignore
    const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') as string;

    // Log para depuração (NÃO use console.log em produção com dados sensíveis, mas aqui ajuda a achar o erro)
    if (!MERCADOPAGO_ACCESS_TOKEN) {
        console.error("[create-mercadopago-preference] ERRO: MERCADOPAGO_ACCESS_TOKEN está vazio ou não configurado.");
        return new Response(JSON.stringify({ error: 'Configuração de pagamento incompleta (Secret missing).' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
    
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

    const { shipping_address, order_id, total_price } = await req.json()
    
    if (total_price <= 0) {
        return new Response(JSON.stringify({ error: 'O valor total do pedido deve ser maior que zero.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }

    const cleanedPhone = shipping_address.phone.replace(/\D/g, '');
    const areaCode = cleanedPhone.substring(0, 2);
    const phoneNumber = cleanedPhone.substring(2);

    const preferencePayload = {
        items: [{
            title: `Pedido #${order_id} - DKCWB`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: total_price,
        }],
        external_reference: order_id.toString(),
        payer: {
            name: shipping_address.first_name,
            surname: shipping_address.last_name,
            email: user.email,
            phone: {
                area_code: areaCode,
                number: phoneNumber,
            },
            address: {
                zip_code: shipping_address.cep.replace(/\D/g, ''),
                street_name: shipping_address.street,
                street_number: shipping_address.number,
            },
        },
        back_urls: {
            success: `${SUPABASE_URL}/functions/v1/mercadopago-webhook?order_id=${order_id}&status=success`,
            failure: `${SUPABASE_URL}/functions/v1/mercadopago-webhook?order_id=${order_id}&status=failure`,
            pending: `${SUPABASE_URL}/functions/v1/mercadopago-webhook?order_id=${order_id}&status=pending`,
        },
        auto_return: "approved",
        notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
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
        console.error("[create-mercadopago-preference] MP API Error:", mpData);
        return new Response(JSON.stringify({ error: mpData.message || 'Erro na API do Mercado Pago' }), {
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