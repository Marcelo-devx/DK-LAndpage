// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// Importar CORS utils do shared
import { getCorsHeaders, createPreflightResponse } from '../_shared/cors.ts';
// Importar logger sanitizado
import { safeErrorLog } from '../_shared/logger.ts';

serve(async (req) => {
  // CORS preflight com validação de origem
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return createPreflightResponse(origin);
  }

  try {
    // 1. Recuperação das variáveis de ambiente
    // @ts-ignore
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string;
    // @ts-ignore
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') as string;
    // @ts-ignore
    const RAW_MP_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') as string;
    // @ts-ignore
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    
    // Verificação robusta do token - SE ESTIVER VAZIO, VAI DAR ERRO AQUI ANTES DE CHAMAR O MP
    if (!RAW_MP_TOKEN || RAW_MP_TOKEN.trim() === '') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Configuração do Mercado Pago incompleta. Token não encontrado ou vazio.',
        details: 'Verifique a variável de ambiente MERCADOPAGO_ACCESS_TOKEN no Supabase e cole o token correto.'
      }), {
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const MP_TOKEN = RAW_MP_TOKEN.trim();
    const IS_SANDBOX = MP_TOKEN.startsWith('TEST-');

    // create service-role supabase client for logging (bypasses RLS)
    let supabaseService: any = null;
    try {
      if (SERVICE_ROLE_KEY) supabaseService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    } catch (e) {
      // Ignora erro de logging
    }

    // 2. Autenticação (opcional para convidados)
    const authHeaderRaw = req.headers.get('Authorization') || req.headers.get('authorization');

    // Normalize header: if token passed without 'Bearer ', add it
    let authHeader: string | null = null;
    if (authHeaderRaw) {
      authHeader = authHeaderRaw.startsWith('Bearer ') ? authHeaderRaw : `Bearer ${authHeaderRaw}`;
    }

    let userEmail: string | undefined;
    let isGuest = false;

    if (authHeader) {
      try {
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { 'Authorization': authHeader } }
        });
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (userError) {
          // Log and continue - we will fallback to guest if possible
        }

        if (user && user.email) {
          userEmail = user.email;
        }
      } catch (e: any) {
        // If auth request fails due to malformed header or similar, log and continue as guest when possible
      }
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    if (!userEmail && body.guest_email) {
      userEmail = body.guest_email;
      isGuest = true;
    }

    const shipping_address = body.shipping_address || body.shippingAddress || null;
    if (!userEmail && shipping_address?.email) {
      userEmail = shipping_address.email;
      isGuest = true;
    }

    if (!userEmail) {
      return new Response(JSON.stringify({
        success: false,
        error: 'E-mail do comprador é obrigatório.'
      }), {
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const orderIdRaw = body.order_id;
    const totalPriceRaw = body.total_price;
    const clientOrigin = body.origin;

    const orderIdStr = (typeof orderIdRaw === 'number' || typeof orderIdRaw === 'string')
      ? String(orderIdRaw).trim()
      : '';

    const totalPriceNum = Number(totalPriceRaw);

    if (!orderIdStr) {
      throw new Error('Order ID is required');
    }

    if (!shipping_address) {
      throw new Error('Shipping address is required');
    }

    if (!Number.isFinite(totalPriceNum) || totalPriceNum <= 0) {
      throw new Error('Total inválido para pagamento.');
    }

    // 3. Preparar dados do pagador
    let payerInfo: any;

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
      const guestPhone = body.guest_phone || '';
      const guestCpf = body.guest_cpf_cnpj || '';
      const cleanPhone = (guestPhone || shipping_address.phone || '').replace(/\D/g, '');
      const cleanCpf = (guestCpf || shipping_address.cpf_cnpj || '').replace(/\D/g, '');
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

    // 4. Configuração de URLs de retorno (Back URLs)
    let settingsBaseUrl: string | undefined;
    let settingsBaseUrlSandbox: string | undefined;

    try {
      const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data: settings } = await supabaseClient
        .from('app_settings')
        .select('key, value')
        .in('key', ['frontend_base_url', 'frontend_base_url_sandbox']);

      if (settings && Array.isArray(settings)) {
        settings.forEach(s => {
          if (s.key === 'frontend_base_url') settingsBaseUrl = s.value;
          if (s.key === 'frontend_base_url_sandbox') settingsBaseUrlSandbox = s.value;
        });
      }
    } catch (e) {
      // Ignora erro de app_settings
    }

    const sandboxBase = Deno.env.get('FRONTEND_BASE_URL_SANDBOX') as string | undefined;
    const prodBase = Deno.env.get('FRONTEND_BASE_URL') as string | undefined;

    const configuredBase = IS_SANDBOX 
      ? (settingsBaseUrlSandbox || sandboxBase)
      : (settingsBaseUrl || prodBase);

    const chosenBase = (configuredBase || clientOrigin || '').toString().trim();
    
    if (!chosenBase) {
      throw new Error('Não foi possível determinar a URL de retorno.');
    }

    const backUrlBase = chosenBase.replace(/\/$/, '');

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
        success: `${backUrlBase}/compras`,
        failure: `${backUrlBase}/compras`,
        pending: `${backUrlBase}/compras`
      },
      auto_return: "approved",
      notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
      statement_descriptor: "DKCWB",
      binary_mode: false
    };
    
    // Helper para chamar a API do MP com um header Authorization dado
    const callMp = async (authHeaderValue: string) => {
      return await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': authHeaderValue,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferencePayload),
      });
    };

    // 5. Chamada à API do Mercado Pago (tenta com 'Bearer <token>' primeiro)
    let mpResponse = await callMp(`Bearer ${MP_TOKEN}`).catch((fetchErr) => {
      throw new Error('Falha de conexão com o Mercado Pago.');
    });

    let mpStatus = mpResponse.status;
    let mpData: any = {};
    try { mpData = await mpResponse.json(); } catch (e) { mpData = {}; }

    // If MP reported a missing Authorization header, try a safe fallback (no "Bearer " prefix or trimmed token)
    const mpMissingAuth = (mpData && (mpData.message || '').toString().toLowerCase().includes('missing authorization')) || mpStatus === 401;
    if (!mpResponse.ok && mpMissingAuth) {
      try {
        const altToken = MP_TOKEN.replace(/^Bearer\s+/i, '');
        mpResponse = await callMp(altToken);
        mpStatus = mpResponse.status;
        try { mpData = await mpResponse.json(); } catch (e) { mpData = {}; }
      } catch (altErr) {
        // Ignora erro de fallback
      }
    }

    if (!mpResponse.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Erro ao processar pagamento no Mercado Pago',
        mp_error: mpData,
        statusCode: mpStatus
      }), {
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({
      success: true,
      order_id: orderIdStr,
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point
    }), {
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    safeErrorLog('Error in MP integration', error);
    return new Response(JSON.stringify({
      success: false,
      error: error?.message || 'Erro interno do servidor'
    }), {
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      status: 200,
    });
  }
})