// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-webhook-token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // @ts-ignore
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string;
    // @ts-ignore
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') as string;
    // @ts-ignore
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    // @ts-ignore
    const RAW_MP_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') as string;

    console.log('[create-mercadopago-preference] Starting...');

    if (!RAW_MP_TOKEN || RAW_MP_TOKEN.trim() === '') {
      console.error('[create-mercadopago-preference] Missing MP token');
      return new Response(JSON.stringify({
        success: false,
        error: 'Configuração do Mercado Pago incompleta. Token não encontrado.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const MP_TOKEN = RAW_MP_TOKEN.trim();
    const IS_SANDBOX = MP_TOKEN.startsWith('TEST-');
    console.log('[create-mercadopago-preference] IS_SANDBOX:', IS_SANDBOX);

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    console.log('[create-mercadopago-preference] Body keys:', Object.keys(body));

    const orderIdRaw = body.order_id;
    const totalPriceRaw = body.total_price;
    const shipping_address = body.shipping_address || body.shippingAddress || null;
    const clientOrigin = body.origin;

    const orderIdStr = (typeof orderIdRaw === 'number' || typeof orderIdRaw === 'string')
      ? String(orderIdRaw).trim() : '';
    const totalPriceNum = Number(totalPriceRaw);

    console.log('[create-mercadopago-preference] orderId:', orderIdStr, 'totalPrice:', totalPriceNum);

    if (!orderIdStr) {
      return new Response(JSON.stringify({ success: false, error: 'Order ID é obrigatório.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }
    if (!shipping_address) {
      return new Response(JSON.stringify({ success: false, error: 'Endereço de entrega é obrigatório.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }
    if (!Number.isFinite(totalPriceNum) || totalPriceNum <= 0) {
      return new Response(JSON.stringify({ success: false, error: `Total inválido: ${totalPriceRaw}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    // --- Buscar email do usuário ---
    let userEmail: string | undefined;

    // 1. Tentar via token de autenticação
    const authHeaderRaw = req.headers.get('Authorization') || req.headers.get('authorization');
    if (authHeaderRaw) {
      try {
        const authHeader = authHeaderRaw.startsWith('Bearer ') ? authHeaderRaw : `Bearer ${authHeaderRaw}`;
        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { 'Authorization': authHeader } }
        });
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user?.email) {
          userEmail = user.email;
          console.log('[create-mercadopago-preference] Got email from auth token');
        }
      } catch (e) {
        console.warn('[create-mercadopago-preference] Could not get user from auth token:', e);
      }
    }

    // 2. Fallback: email do body (convidado)
    if (!userEmail && body.guest_email) {
      userEmail = body.guest_email;
      console.log('[create-mercadopago-preference] Got email from guest_email');
    }

    // 3. Fallback: email do shipping_address
    if (!userEmail && shipping_address?.email) {
      userEmail = shipping_address.email;
      console.log('[create-mercadopago-preference] Got email from shipping_address');
    }

    // 4. Fallback: buscar no banco via service role
    if (!userEmail) {
      try {
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: orderRow } = await supabaseAdmin
          .from('orders')
          .select('user_id, guest_email')
          .eq('id', parseInt(orderIdStr))
          .single();

        if (orderRow?.guest_email) {
          userEmail = orderRow.guest_email;
          console.log('[create-mercadopago-preference] Got email from order.guest_email');
        } else if (orderRow?.user_id) {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(orderRow.user_id);
          if (authUser?.user?.email) {
            userEmail = authUser.user.email;
            console.log('[create-mercadopago-preference] Got email from auth.admin.getUserById');
          }
        }
      } catch (e) {
        console.warn('[create-mercadopago-preference] Could not fetch email from DB:', e);
      }
    }

    if (!userEmail) {
      return new Response(JSON.stringify({ success: false, error: 'E-mail do comprador é obrigatório.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    console.log('[create-mercadopago-preference] userEmail resolved:', userEmail.substring(0, 5) + '***');

    // --- Preparar dados do pagador ---
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
      const streetNumber = parseInt(shipping_address.number) || 0;

      payerInfo = {
        name: shipping_address.first_name || 'Cliente',
        surname: shipping_address.last_name || 'DK',
        email: userEmail,
      };

      // Só adiciona phone se válido
      if (cleanPhone.length >= 10) {
        payerInfo.phone = {
          area_code: cleanPhone.substring(0, 2),
          number: cleanPhone.substring(2)
        };
      }

      // Só adiciona identification se CPF/CNPJ válido
      if (cleanCpf.length === 11 || cleanCpf.length === 14) {
        payerInfo.identification = {
          type: cleanCpf.length > 11 ? 'CNPJ' : 'CPF',
          number: cleanCpf
        };
      }

      // Só adiciona address se CEP válido
      if (cleanCep.length === 8) {
        payerInfo.address = {
          zip_code: cleanCep,
          street_name: shipping_address.street || '',
          street_number: streetNumber
        };
      }
    }

    console.log('[create-mercadopago-preference] payerInfo.email:', payerInfo.email?.substring(0, 5) + '***');

    // --- Buscar back URL ---
    let backUrlBase = '';

    try {
      const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data: settings } = await supabaseClient
        .from('app_settings')
        .select('key, value')
        .in('key', ['frontend_base_url', 'frontend_base_url_sandbox']);

      if (settings && Array.isArray(settings)) {
        const map: Record<string, string> = {};
        settings.forEach((s: any) => { map[s.key] = s.value; });
        backUrlBase = IS_SANDBOX
          ? (map['frontend_base_url_sandbox'] || map['frontend_base_url'] || '')
          : (map['frontend_base_url'] || '');
      }
    } catch (e) {
      console.warn('[create-mercadopago-preference] Could not fetch settings:', e);
    }

    if (!backUrlBase) {
      // @ts-ignore
      backUrlBase = IS_SANDBOX
        // @ts-ignore
        ? (Deno.env.get('FRONTEND_BASE_URL_SANDBOX') || Deno.env.get('FRONTEND_BASE_URL') || clientOrigin || '')
        // @ts-ignore
        : (Deno.env.get('FRONTEND_BASE_URL') || clientOrigin || '');
    }

    backUrlBase = (backUrlBase || clientOrigin || '').toString().trim().replace(/\/$/, '');

    // Mercado Pago rejeita URLs localhost/127.0.0.1 nas back_urls — usar sempre a URL de produção
    if (!backUrlBase || backUrlBase.includes('localhost') || backUrlBase.includes('127.0.0.1')) {
      backUrlBase = 'https://dkcwb.com';
    }

    if (!backUrlBase) {
      return new Response(JSON.stringify({ success: false, error: 'URL de retorno não configurada.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    console.log('[create-mercadopago-preference] backUrlBase:', backUrlBase);

    // --- Montar preferência ---
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
        success: `${backUrlBase}/confirmacao-pedido/${orderIdStr}`,
        failure: `${backUrlBase}/compras`,
        pending: `${backUrlBase}/compras`
      },
      auto_return: "approved",
      notification_url: `${SUPABASE_URL}/functions/v1/mercadopago-webhook`,
      statement_descriptor: "DKCWB",
      binary_mode: false
    };

    console.log('[create-mercadopago-preference] Calling MP API with total:', totalPriceNum.toFixed(2));

    // --- Chamar MP ---
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferencePayload),
    });

    const mpData: any = await mpResponse.json().catch(() => ({}));

    console.log('[create-mercadopago-preference] MP response status:', mpResponse.status);

    if (!mpResponse.ok) {
      console.error('[create-mercadopago-preference] MP error:', JSON.stringify(mpData));
      return new Response(JSON.stringify({
        success: false,
        error: mpData?.message || 'Erro ao processar pagamento no Mercado Pago.',
        mp_error: mpData,
        statusCode: mpResponse.status
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    console.log('[create-mercadopago-preference] Success! init_point:', mpData.init_point?.substring(0, 50) + '...');

    return new Response(JSON.stringify({
      success: true,
      order_id: orderIdStr,
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error: any) {
    console.error('[create-mercadopago-preference] Fatal error:', error?.message || error);
    return new Response(JSON.stringify({
      success: false,
      error: error?.message || 'Erro interno do servidor'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  }
})