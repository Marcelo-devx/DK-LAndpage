// redeploy: 2026-10-24T19:44:15.261Z — atualização solicitada após deploy; disponibilidade verificada separadamente
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

declare const Deno: any;

const REDEPLOY_TIMESTAMP = '2026-10-24T19:44:15.261Z';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// OPTIONS instancia os handlers sem executar operações de negócio.
const OPTIONS_FUNCTIONS = [
  'auth-send-email',
  'change-password',
  'chat-proxy',
  'create-mercadopago-preference',
  'create-mp-preference',
  'create-user',
  'dispatch-webhook',
  'find-order-by-phone',
  'forgot-password',
  'generate-token',
  'get-order-details',
  'get-order-public',
  'health-check',
  'log-integration',
  'mercadopago-webhook',
  'notify-password-change',
  'process-mercadopago-payment',
  'reset-user-password',
  'send-auth-hook',
  'send-email-via-resend',
  'send-order-email',
  'trigger-integration',
  'update-order-status',
  'update-password-admin',
  'validate-cep',
  'validate-token',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!supabaseUrl || !anonKey) {
    console.error('[keep-alive] Missing env vars');
    return new Response(JSON.stringify({ ok: false, error: 'Missing env vars' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: Record<string, string> = {};
  const checks: Record<string, {
    status_code: number | null;
    response_ms: number;
    checked_at: string;
    error_msg: string | null;
  }> = {};

  await Promise.all(OPTIONS_FUNCTIONS.map(async (fn) => {
    const started = Date.now();
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
        method: 'OPTIONS',
        headers: { apikey: anonKey },
        signal: AbortSignal.timeout(8000),
      });
      // send-auth-hook rejeita métodos diferentes de POST com 405 antes de processar o payload.
      const available = res.status === 200 || res.status === 204 ||
        (fn === 'send-auth-hook' && res.status === 405);
      results[fn] = available ? 'warm' : `status:${res.status}`;
      checks[fn] = {
        status_code: res.status,
        response_ms: Date.now() - started,
        checked_at: new Date().toISOString(),
        error_msg: available ? null : `OPTIONS returned HTTP ${res.status}`,
      };
      await res.body?.cancel();
      console.log(`[keep-alive] OPTIONS ${fn} -> ${results[fn]} (${res.status})`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown';
      results[fn] = `error:${message}`;
      checks[fn] = {
        status_code: null,
        response_ms: Date.now() - started,
        checked_at: new Date().toISOString(),
        error_msg: message,
      };
      console.warn(`[keep-alive] OPTIONS ${fn} -> error:`, message);
    }
  }));

  const warm = Object.values(results).filter((v) => v === 'warm').length;
  const total = OPTIONS_FUNCTIONS.length;
  const ok = warm === total;
  console.log(`[keep-alive] Concluído: ${warm}/${total} warm`);

  return new Response(JSON.stringify({
    ok,
    timestamp: new Date().toISOString(),
    redeploy_timestamp: REDEPLOY_TIMESTAMP,
    probe: 'OPTIONS — disponibilidade do handler, não validação funcional',
    warm,
    total,
    results,
    checks,
  }), {
    status: ok ? 200 : 503,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
