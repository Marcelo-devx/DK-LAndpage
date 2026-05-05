// redeploy: 2026-05-05T18:50:00Z — warm critical functions via GET /health
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Funções críticas — aquecidas via GET /health (executa o runtime de verdade)
const CRITICAL_FUNCTIONS = [
  'trigger-integration',
  'update-order-status',
  'get-order-details',
  'get-order-public',
  'mercadopago-webhook',
  'process-mercadopago-payment',
  'send-order-email',
  'send-email-via-resend',
];

// Demais funções — aquecidas via OPTIONS (mais leve)
const OTHER_FUNCTIONS = [
  'generate-token',
  'validate-token',
  'create-user',
  'forgot-password',
  'notify-password-change',
  'reset-user-password',
  'update-password-admin',
  'health-check',
  'create-mercadopago-preference',
  'create-mp-preference',
  'create-mercadopago-pix',
  'get-mercadopago-status',
  'mp-webhook',
  'find-order-by-phone',
  'admin-get-order-history',
  'admin-update-order',
  'admin-cancel-order',
  'admin-delete-order',
  'get-users',
  'admin-create-user',
  'admin-delete-user',
  'admin-list-users',
  'admin-block-user',
  'bulk-add-points',
  'bulk-import-clients',
  'n8n-webhook',
  'n8n-receive-order',
  'dispatch-webhook',
  'log-integration',
  'cloudinary-upload',
  'cloudinary-list-images',
  'cloudinary-delete-image',
  'cloudinary-usage',
  'chat-proxy',
  'catalog-api',
  'analytics-bi',
  'actionable-insights',
  'generate-sales-popups',
  'validate-cep',
];

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

  // Aquece funções críticas via GET /health (garante que o runtime executa de verdade)
  await Promise.allSettled(
    CRITICAL_FUNCTIONS.map(async (fn) => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/${fn}/health`, {
          method: 'GET',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
          },
          signal: AbortSignal.timeout(10000),
        });
        const status = res.status;
        results[fn] = `warm(${status})`;
        console.log(`[keep-alive] ${fn} -> warm(${status})`);
      } catch (err: any) {
        results[fn] = `error:${err?.message || 'unknown'}`;
        console.warn(`[keep-alive] ${fn} -> error:`, err?.message);
      }
    })
  );

  // Aquece demais funções via OPTIONS (mais leve)
  await Promise.allSettled(
    OTHER_FUNCTIONS.map(async (fn) => {
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
