// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('[create-mercadopago-preference] Iniciando...');

    // 1. Recuperação das variáveis de ambiente
    // @ts-ignore
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string;
    // @ts-ignore
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') as string;
    // @ts-ignore
    const RAW_MP_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') as string;

    if (!RAW_MP_TOKEN) {
      throw new Error("Token do Mercado Pago não configurado.");
    }

    const MP_TOKEN = RAW_MP_TOKEN.trim(); 
    const IS_SANDBOX = MP_TOKEN.startsWith('TEST-');

    console.log('[create-mercadopago-preference] Modo:', IS_SANDBOX ? 'SANDBOX' : 'PRODUÇÃO');

    // 2. Autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Autenticação ausente.");
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { 
      global: { headers: { 'Authorization': authHeader } } 
    });
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user || !user.email) {
      console.error('[create-mercadopago-preference] Erro de autenticação:', userError);
      throw new Error("Usuário não autenticado.");
    }

    const userEmail = user.email;
    console.log('[create-mercadopago-preference] Usuário:', userEmail);

    // 3. Parse do body
    const { order_id, total_price, origin, shipping_address } = await req.json();

    console.log('[create-mercadopago-preference] Dados recebidos:', {
      order_id,
      total_price,
      origin,
      has_shipping: !!shipping_address
    });

    if (!shipping_address || !order_id || !total_price) {
      throw new Error('Dados do pedido incompletos.');
    }

    // 4. Preparar dados do pagador
    let payerInfo;

    if (IS_SANDBOX) {
      payerInfo = {
        name: "Test",
        surname: "User",
        email: "test_user_123456@testuser.com",
        phone: { area_code: "11", number: "988888888" },
        identification: { type: "CPF", number: "19119119100" },
        address: { zip_code: "01001000", street_name: "Rua de Teste", street_number: 123 }
      };
    } else {
      const cleanPhone = (shipping_address.phone || '').replace(/\D/g, '');
      const cleanCpf = (shipping_address.cpf_cnpj || '').replace(/\D/g, '');
      const cleanCep = (shipping_address.cep || '').replace(/\D/g, '');
      
      payerInfo = {
        name: shipping_address.first_name,
        surname: shipping_address.last_name,
        email: userEmail,
        phone: {
          area_code: cleanPhone.substring(0, 2),
          number: cleanPhone.substring(2)
        },
        identification: {
          type: cleanCpf.length > 11 ? 'CNPJ' : 'CPF',
          number: cleanCpf
        },
        address: {
          zip_code: cleanCep,
          street_name: shipping_address.street,
          street_number: parseInt(shipping_address.number) || 0
        }
      };
    }

    // 5. Criar preferência
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
        failure: `${origin}/pedidos`,
        pending: `${origin}/confirmacao-pedido/${order_id}`
      },
      auto_return: "approved",
      notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
      statement_descriptor: "DKCWB",
      binary_mode: IS_SANDBOX
    };

    console.log('[create-mercadopago-preference] Criando preferência no MP...');

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferencePayload),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('[create-mercadopago-preference] Erro do MP:', JSON.stringify(mpData));
      const errorMsg = mpData.message || 'Erro ao criar preferência';
      throw new Error(`Mercado Pago: ${errorMsg}`);
    }

    console.log('[create-mercadopago-preference] Preferência criada com sucesso!');

    return new Response(JSON.stringify({
      success: true,
      order_id: order_id,
      init_point: mpData.init_point, 
      sandbox_init_point: mpData.sandbox_init_point
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[create-mercadopago-preference] Erro:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Erro interno do servidor'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})