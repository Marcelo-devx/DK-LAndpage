// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Todas as edge functions que precisam ficar aquecidas.
// Mantemos aqui TODAS as funções existentes no projeto Supabase — mesmo que
// algumas não estejam no código atual deste repo, elas estão deployadas
// no projeto e precisam ficar quentes para resposta rápida.
const FUNCTIONS_TO_WARM = Array.from(new Set([
  // ── Auth / cadastro / email ───────────────────────────────────────────
  'generate-token',
  'validate-token',
  'send-email-via-resend',
  'create-user',
  'forgot-password',
  'notify-password-change',
  'reset-user-password',
  'update-password-admin',
  'health-check',

  // ── Pedidos / pagamento ───────────────────────────────────────────────
  'process-mercadopago-payment',
  'create-mercadopago-preference',
  'create-mp-preference',
  'create-mercadopago-pix',
  'get-mercadopago-status',
  'mercadopago-webhook',
  'mp-webhook',
  'update-order-status',
  'get-order-details',
  'get-order-public',
  'find-order-by-phone',
  'admin-get-order-history',
  'admin-update-order',
  'admin-cancel-order',
  'admin-delete-order',
  'admin-validate-order',

  // ── Usuários / admin ──────────────────────────────────────────────────
  'get-users',
  'admin-create-user',
  'admin-delete-user',
  'admin-list-users',
  'admin-block-user',
  'bulk-add-points',
  'bulk-import-clients',

  // ── Integrações / webhooks ────────────────────────────────────────────
  'n8n-webhook',
  'n8n-receive-order',
  'dispatch-webhook',
  'trigger-integration',
  'log-integration',

  // ── Cloudinary ────────────────────────────────────────────────────────
  'cloudinary-upload',
  'cloudinary-list-images',
  'cloudinary-delete-image',
  'cloudinary-usage',

  // ── Outros ────────────────────────────────────────────────────────────
  'chat-proxy',
  'catalog-api',
  'analytics-bi',
  'actionable-insights',
  'generate-sales-popups',
  'validate-cep',
]));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

  if (!supabaseUrl || !anonKey) {
    console.error('[keep-alive] Missing env vars');
    return new Response(JSON.stringify({ error: 'Missing env vars' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: Record<string, string> = {};

  // Aquece todas as funções em paralelo com OPTIONS (sem custo de processamento)
  await Promise.allSettled(
    FUNCTIONS_TO_WARM.map(async (fn) => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
          method: 'OPTIONS',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
          },
        });
        results[fn] = res.ok || res.status === 204 || res.status === 200 ? 'warm' : `status:${res.status}`;
        console.log(`[keep-alive] ${fn} -> ${results[fn]}`);
      } catch (err: any) {
        results[fn] = `error:${err?.message || 'unknown'}`;
        console.warn(`[keep-alive] ${fn} -> error:`, err?.message);
      }
    })
  );

  console.log('[keep-alive] Warm-up concluído', results);

  return new Response(JSON.stringify({ ok: true, timestamp: new Date().toISOString(), results }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});