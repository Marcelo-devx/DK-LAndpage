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
    console.log('[create-mercadopago-preference] Iniciando processamento...');

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
      console.error('[create-mercadopago-preference] ERRO CRÍTICO: Variável MERCADOPAGO_ACCESS_TOKEN não encontrada ou está VAZIA no ambiente.');
      return new Response(JSON.stringify({
        success: false,
        error: 'Configuração do Mercado Pago incompleta. Token não encontrado ou vazio.',
        details: 'Verifique a variável de ambiente MERCADOPAGO_ACCESS_TOKEN no Supabase e cole o token correto.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const MP_TOKEN = RAW_MP_TOKEN.trim();
    const IS_SANDBOX = MP_TOKEN.startsWith('TEST-');
    const MODE = IS_SANDBOX ? 'SANDBOX' : 'PRODUÇÃO';

    console.log('[create-mercadopago-preference] Modo de operação:', MODE);
    console.log('[create-mercadopago-preference] Token carregado com sucesso (primeiros 8 chars):', MP_TOKEN.substring(0, 8) + '...');

    // create service-role supabase client for logging (bypasses RLS)
    let supabaseService: any = null;
    try {
      if (SERVICE_ROLE_KEY) supabaseService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    } catch (e) {
      console.warn('[create-mercadopago-preference] Não foi possível criar supabase service client para logging:', e);
    }

    // 2. Autenticação (opcional para convidados)
    const authHeaderRaw = req.headers.get('Authorization') || req.headers.get('authorization');
    console.log('[create-mercadopago-preference] Incoming Authorization header:', authHeaderRaw ? '[REDACTED]' : 'none');

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
          console.warn('[create-mercadopago-preference] supabase.auth.getUser returned an error:', userError.message || userError);
        }

        if (user && user.email) {
          userEmail = user.email;
          console.log('[create-mercadopago-preference] Usuário autenticado:', userEmail);
        }
      } catch (e: any) {
        // If auth request fails due to malformed header or similar, log and continue as guest when possible
        console.warn('[create-mercadopago-preference] Erro na validação do token de sessão, prosseguindo como convidado se possível.', e?.message || e);
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
      console.log('[create-mercadopago-preference] Identificado como convidado (guest_email):', userEmail);
    }

    const shipping_address = body.shipping_address || body.shippingAddress || null;
    if (!userEmail && shipping_address?.email) {
      userEmail = shipping_address.email;
      isGuest = true;
      console.log('[create-mercadopago-preference] Identificado como convidado (shipping_address):', userEmail);
    }

    if (!userEmail) {
      console.error('[create-mercadopago-preference] Erro: E-mail do comprador não fornecido.');
      return new Response(JSON.stringify({
        success: false,
        error: 'E-mail do comprador é obrigatório.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    console.log('[create-mercadopago-preference] Dados do pedido:', { order_id: orderIdStr, total: totalPriceNum });

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
      console.warn('[create-mercadopago-preference] Falha ao ler app_settings, usando fallback.');
    }

    const configuredBase = (IS_SANDBOX 
      ? (settingsBaseUrlSandbox || // @ts-ignore
        Deno.env.get('FRONTEND_BASE_URL_SANDBOX'))
      : (settingsBaseUrl || // @ts-ignore
        Deno.env.get('FRONTEND_BASE_URL'))
    ) || undefined;

    const chosenBase = (configuredBase || clientOrigin || '').toString().trim();
    
    if (!chosenBase) {
      throw new Error('Não foi possível determinar a URL de retorno.');
    }

    const backUrlBase = chosenBase.replace(/\/$/, '');
    console.log('[create-mercadopago-preference] Base de retorno configurada:', backUrlBase);

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

    console.log('[create-mercadopago-preference] Enviando requisição para Mercado Pago API...');
    
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
      console.error('[create-mercadopago-preference] Erro de rede ao chamar MP (primeira tentativa):', fetchErr);
      throw new Error('Falha de conexão com o Mercado Pago.');
    });

    let mpStatus = mpResponse.status;
    let mpData: any = {};
    try { mpData = await mpResponse.json(); } catch (e) { console.warn('[create-mercadopago-preference] Resposta do MP não é JSON.'); }

    console.log('[create-mercadopago-preference] Status Resposta MP (primeira tentativa):', mpStatus);
    console.log('[create-mercadopago-preference] Body Resposta MP (primeira tentativa):', JSON.stringify(mpData));

    // If MP reported a missing Authorization header, try a safe fallback (no "Bearer " prefix or trimmed token)
    const mpMissingAuth = (mpData && (mpData.message || '').toString().toLowerCase().includes('missing authorization')) || mpStatus === 401;
    if (!mpResponse.ok && mpMissingAuth) {
      console.warn('[create-mercadopago-preference] Mercado Pago respondeu faltando header de auth; tentando fallback sem prefixo Bearer (ou corrigindo token)');
      // Try with raw token (in case the token already contained 'Bearer ' or MP expects no Bearer)
      try {
        const altToken = MP_TOKEN.replace(/^Bearer\s+/i, '');
        mpResponse = await callMp(altToken);
        mpStatus = mpResponse.status;
        try { mpData = await mpResponse.json(); } catch (e) { mpData = {}; }
        console.log('[create-mercadopago-preference] Status Resposta MP (fallback):', mpStatus);
        console.log('[create-mercadopago-preference] Body Resposta MP (fallback):', JSON.stringify(mpData));
      } catch (altErr) {
        console.error('[create-mercadopago-preference] Fallback para chamada MP falhou:', altErr);
      }
    }

    if (!mpResponse.ok) {
      console.error('[create-mercadopago-preference] Mercado Pago retornou erro (final):', mpData);

      // Attempt to log this failure to integration_logs using service role client
      try {
        if (supabaseService) {
          await supabaseService.from('integration_logs').insert({
            event_type: 'mercadopago_preference',
            status: 'error',
            response_code: mpStatus,
            details: JSON.stringify(mpData),
            payload: { order_id: orderIdStr, total_price: totalPriceNum, email: userEmail }
          });
          console.log('[create-mercadopago-preference] Erro registrado em integration_logs');
        }
      } catch (logErr) {
        console.warn('[create-mercadopago-preference] Falha ao salvar integration_log:', logErr);
      }

      return new Response(JSON.stringify({
        success: false,
        error: 'Erro ao processar pagamento no Mercado Pago',
        mp_error: mpData,
        statusCode: mpStatus
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
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
    console.error("[create-mercadopago-preference] Erro interno:", error);

    // Log unexpected internal errors as well
    try {
      // @ts-ignore
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string;
      // @ts-ignore
      const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
      if (SERVICE_ROLE_KEY) {
        const supabaseService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
        await supabaseService.from('integration_logs').insert({
          event_type: 'mercadopago_preference',
          status: 'error',
          details: error?.message || String(error),
        });
        console.log('[create-mercadopago-preference] Erro interno registrado em integration_logs');
      }
    } catch (logErr) {
      console.warn('[create-mercadopago-preference] Falha ao salvar log interno:', logErr);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error?.message || 'Erro interno do servidor'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
})