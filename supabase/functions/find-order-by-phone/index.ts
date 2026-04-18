// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// CORS aberto — esta função é chamada pelo n8n (servidor externo)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-webhook-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/**
 * Normaliza um número de telefone e retorna todas as variações possíveis para busca.
 * Trata: DDI 55, com/sem o 9 dígito, com/sem máscara.
 *
 * Exemplos:
 *   "553291213190" → ["553291213190", "3291213190", "32991213190"]
 *   "32991213190"  → ["32991213190", "3291213190"]
 *   "3291213190"   → ["3291213190", "32991213190"]
 */
function normalizePhone(raw: string): string[] {
  // Remove tudo que não é dígito
  const clean = raw.replace(/\D/g, '');
  const variants = new Set<string>();

  variants.add(clean);

  // Remove DDI 55 se presente (12+ dígitos começando com 55)
  let noDdi = clean;
  if (clean.startsWith('55') && clean.length >= 12) {
    noDdi = clean.slice(2);
    variants.add(noDdi);
  }

  // Gera variação SEM o 9 (se 11 dígitos: DDD + 9 + 8 dígitos)
  if (noDdi.length === 11) {
    const noNine = noDdi.slice(0, 2) + noDdi.slice(3); // remove o 3º dígito (o 9)
    variants.add(noNine);
  }

  // Gera variação COM o 9 (se 10 dígitos: DDD + 8 dígitos)
  if (noDdi.length === 10) {
    const withNine = noDdi.slice(0, 2) + '9' + noDdi.slice(2); // insere 9 após o DDD
    variants.add(withNine);
  }

  return Array.from(variants);
}

// redeploy: v2
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  // Health check — mantém a função aquecida
  const url = new URL(req.url)
  if (req.method === 'GET' && url.pathname.endsWith('/health')) {
    return new Response(JSON.stringify({ status: 'ok', function: 'find-order-by-phone', ts: Date.now() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  try {
    // ── Autenticação ──────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    const webhookSecretHeader = req.headers.get('x-webhook-secret') || req.headers.get('x-webhook-token');

    // @ts-ignore
    const secretFromEnv = (Deno.env.get('N8N_SECRET_TOKEN') || '').trim();

    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: tokenSetting } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'n8n_integration_token')
      .maybeSingle();
    const secretFromDb = (tokenSetting?.value || '').trim();

    const bearerToken = authHeader?.includes('Bearer') ? authHeader.replace('Bearer ', '').trim() : null;
    const receivedToken = webhookSecretHeader || bearerToken || '';

    const validSecrets = [secretFromEnv, secretFromDb].filter(Boolean);
    const isAuthorized = validSecrets.length > 0 && validSecrets.some(s => s === receivedToken);

    console.log('[find-order-by-phone] Auth check', {
      hasWebhookHeader: !!webhookSecretHeader,
      hasBearerToken: !!bearerToken,
      isAuthorized,
    });

    if (!isAuthorized) {
      console.error('[find-order-by-phone] Acesso negado — token inválido');
      return new Response(JSON.stringify({ error: 'Acesso negado. Token inválido.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Parse do body ─────────────────────────────────────────────────────────
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Body JSON inválido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawPhone: string = String(body.phone || body.telefone || body.whatsapp || '').trim();
    const orderId: number | null = body.order_id ? Number(body.order_id) : null;
    // NOVO: aceitar email como fallback para encontrar o pedido
    const email: string | null = (body.email || body.email_address || body.customer_email || null);

    console.log('[find-order-by-phone] Request', { rawPhone, orderId, hasEmail: !!email });

    if (!rawPhone && !email) {
      return new Response(JSON.stringify({ error: 'Campo "phone" ou "email" é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Normalização do telefone ───────────────────────────────────────────────
    const phoneVariants = rawPhone ? normalizePhone(rawPhone) : [];
    console.log('[find-order-by-phone] Phone variants', phoneVariants);

    // ── Busca no banco ────────────────────────────────────────────────────────
    // Usa a função SQL que trata todas as variações de telefone + email como fallback
    const { data: orders, error: dbError } = await supabaseAdmin
      .rpc('find_pending_orders_by_phone', {
        p_phone: rawPhone || '',
        p_order_id: orderId,
        p_email: email,
      });

    if (dbError) {
      console.error('[find-order-by-phone] DB error', dbError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar pedido no banco.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[find-order-by-phone] Found orders', { count: orders?.length ?? 0 });

    if (!orders || orders.length === 0) {
      // Busca adicional: se order_id foi fornecido, tenta buscar só pelo ID para dar mensagem mais precisa
      if (orderId) {
        const { data: orderById } = await supabaseAdmin
          .from('orders')
          .select('id, status, payment_method, shipping_address')
          .eq('id', orderId)
          .single();

        if (orderById) {
          const phoneInOrder = (orderById.shipping_address?.phone || '').replace(/\D/g, '');
          console.log('[find-order-by-phone] Order found by ID but phone/email mismatch', {
            orderId,
            phoneInOrder,
            phoneVariants,
            hasEmail: !!email,
          });
          return new Response(JSON.stringify({
            found: false,
            message: `Pedido #${orderId} encontrado, mas o telefone não confere. Verifique se o número cadastrado no site é o mesmo do WhatsApp.`,
            debug: {
              order_status: orderById.status,
              phone_variants_tried: phoneVariants,
            },
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({
        found: false,
        message: 'Nenhum pedido pendente encontrado para este telefone.',
        phone_variants_tried: phoneVariants,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Retorna o pedido mais recente (primeiro da lista, já ordenado por created_at DESC)
    const latestOrder = orders[0];

    // Buscar itens do pedido
    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select('name_at_purchase, quantity, price_at_purchase')
      .eq('order_id', latestOrder.order_id);

    console.log('[find-order-by-phone] Returning order', { orderId: latestOrder.order_id, status: latestOrder.status });

    return new Response(JSON.stringify({
      found: true,
      order: {
        id: latestOrder.order_id,
        status: latestOrder.status,
        total_price: latestOrder.total_price,
        payment_method: latestOrder.payment_method,
        created_at: latestOrder.created_at,
        customer_name: latestOrder.customer_name,
        customer_phone: latestOrder.customer_phone,
        items: items || [],
      },
      all_orders: orders,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[find-order-by-phone] Fatal error', err?.message || err);
    return new Response(JSON.stringify({ error: err?.message || 'Erro interno.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
