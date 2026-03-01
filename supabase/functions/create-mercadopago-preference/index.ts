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
    // NOVO: Bases configuráveis por ambiente
    // @ts-ignore
    const FRONTEND_BASE_URL = Deno.env.get('FRONTEND_BASE_URL') as string | undefined;
    // @ts-ignore
    const FRONTEND_BASE_URL_SANDBOX = Deno.env.get('FRONTEND_BASE_URL_SANDBOX') as string | undefined;

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

    // 3. Parse do body (com validações mais claras)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const orderIdRaw = body.order_id;
    const totalPriceRaw = body.total_price;
    // Em vez de depender do origin do cliente, usaremos uma base validada (com fallback no final)
    const clientOrigin = body.origin;
    const shipping_address = body.shipping_address;

    const orderIdStr = (typeof orderIdRaw === 'number' || typeof orderIdRaw === 'string')
      ? String(orderIdRaw).trim()
      : '';

    const totalPriceNum = Number(totalPriceRaw);

    console.log('[create-mercadopago-preference] Dados recebidos:', {
      order_id: orderIdStr,
      total_price: totalPriceNum,
      client_origin: clientOrigin,
      has_shipping: !!shipping_address
    });

    if (!orderIdStr) {
      throw new Error('Order ID is required');
    }

    if (!shipping_address) {
      throw new Error('Shipping address is required');
    }

    if (!Number.isFinite(totalPriceNum) || totalPriceNum <= 0) {
      throw new Error('Total inválido para pagamento.');
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

    // 5. Selecionar a base das back_urls por prioridade: ENV -> app_settings -> client
    let settingsBaseUrl: string | undefined;
    let settingsBaseUrlSandbox: string | undefined;

    try {
      const { data: settings } = await supabaseClient
        .from('app_settings')
        .select('key, value')
        .in('key', ['frontend_base_url', 'frontend_base_url_sandbox']);

      if (settings && Array.isArray(settings)) {
        for (const s of settings) {
          if (s.key === 'frontend_base_url') settingsBaseUrl = s.value;
          if (s.key === 'frontend_base_url_sandbox') settingsBaseUrlSandbox = s.value;
        }
      }
    } catch (e) {
      console.warn('[create-mercadopago-preference] Falha ao ler app_settings, continuando com ENV/cliente...');
    }

    const configuredBase =
      (IS_SANDBOX ? (FRONTEND_BASE_URL_SANDBOX || settingsBaseUrlSandbox) : (FRONTEND_BASE_URL || settingsBaseUrl))
      || undefined;

    const chosenBase = (configuredBase || clientOrigin || '').toString().trim();
    if (!chosenBase) {
      throw new Error('Frontend base URL ausente. Defina FRONTEND_BASE_URL (e opcionalmente FRONTEND_BASE_URL_SANDBOX) ou app_settings.frontend_base_url.');
    }

    const backUrlBase = chosenBase.replace(/\/$/, '');
    console.log('[create-mercadopago-preference] Base escolhida para retorno:', {
      is_sandbox: IS_SANDBOX,
      from: configuredBase ? 'config' : 'client',
      base: backUrlBase
    });

    const preferencePayload = {
      items: [{
        id: orderIdStr,
        title: `Pedido #${orderIdStr} - DKCWB`,
        quantity: 1,
        currency_id: "BRL",
        unit_price: Number(totalPriceNum.toFixed(2)),
      }],
      external_reference: orderIdStr,
      payer: payerInfo,
      back_urls: {
        // Após o pagamento, direciona o usuário para "Minhas Compras"
        success: `${backUrlBase}/compras`,
        failure: `${backUrlBase}/compras`,
        pending: `${backUrlBase}/compras`
      },
      auto_return: "approved",
      notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
      statement_descriptor: "DKCWB",
      binary_mode: false
    };

    console.log('[create-mercadopago-preference] Back URLs definidas:', preferencePayload.back_urls);

    console.log('[create-mercadopago-preference] Criando preferência no MP...');
    console.log('[create-mercadopago-preference] Back URLs:', preferencePayload.back_urls);

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferencePayload),
    });

    const mpData = await mpResponse.json().catch(() => ({}));

    if (!mpResponse.ok) {
      console.error('[create-mercadopago-preference] Erro do MP:', JSON.stringify(mpData));
      const errorMsg = mpData.message || 'Erro ao criar preferência';
      return new Response(JSON.stringify({
        success: false,
        error: `Mercado Pago: ${errorMsg}`,
        mp_error: mpData,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log('[create-mercadopago-preference] Preferência criada com sucesso!');

    return new Response(JSON.stringify({
      success: true,
      order_id: orderIdStr,
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("[create-mercadopago-preference] Erro:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error?.message || 'Erro interno do servidor'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})