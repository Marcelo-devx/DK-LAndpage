// redeploy: 2026-07-13T11:00:00Z — warm auth functions with real POST
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Funções aquecidas via OPTIONS (confirma que o container está vivo)
const OPTIONS_FUNCTIONS = [
  'process-mercadopago-payment',
  'create-mercadopago-preference',
  'mercadopago-webhook',
  'update-order-status',
  'get-order-details',
  'get-order-public',
  'send-order-email',
  'trigger-integration',
  'dispatch-webhook',
  'log-integration',
  'find-order-by-phone',
  'validate-cep',
  'health-check',
  'chat-proxy',
  'notify-password-change',
  'reset-user-password',
  'update-password-admin',
];

// Funções de auth aquecidas via POST real (body intencionalmente inválido para forçar
// instanciação do container; retornam 400/422 mas isso é suficiente para warm-up)
const POST_WARMUP_FUNCTIONS = [
  { name: 'generate-token',       body: { __warmup: true } },
  { name: 'validate-token',       body: { __warmup: true } },
  { name: 'create-user',          body: { __warmup: true } },
  { name: 'send-email-via-resend', body: { __warmup: true } },
  { name: 'forgot-password',      body: { __warmup: true } },
  { name: 'change-password',      body: { __warmup: true } },
  { name: 'send-auth-hook',       body: { __warmup: true } },
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

  // Aquecer via OPTIONS
  await Promise.allSettled(
    OPTIONS_FUNCTIONS.map(async (fn) => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
          method: 'OPTIONS',
          headers: { 'apikey': anonKey },
          signal: AbortSignal.timeout(8000),
        });
        const ok = res.status === 200 || res.status === 204 || res.status === 405;
        results[fn] = ok ? 'warm' : `status:${res.status}`;
        console.log(`[keep-alive] OPTIONS ${fn} -> ${results[fn]}`);
      } catch (err: any) {
        results[fn] = `error:${err?.message || 'unknown'}`;
        console.warn(`[keep-alive] OPTIONS ${fn} -> error:`, err?.message);
      }
    })
  );

  // Aquecer funções de auth via POST real
  await Promise.allSettled(
    POST_WARMUP_FUNCTIONS.map(async ({ name, body }) => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(8000),
        });
        // 400/422 = container ativo e respondendo (body inválido esperado)
        const ok = res.status < 500;
        results[name] = ok ? 'warm' : `status:${res.status}`;
        console.log(`[keep-alive] POST ${name} -> ${results[name]} (${res.status})`);
      } catch (err: any) {
        results[name] = `error:${err?.message || 'unknown'}`;
        console.warn(`[keep-alive] POST ${name} -> error:`, err?.message);
      }
    })
  );

  const warm = Object.values(results).filter((v) => v === 'warm').length;
  const total = OPTIONS_FUNCTIONS.length + POST_WARMUP_FUNCTIONS.length;
  console.log(`[keep-alive] Concluído: ${warm}/${total} warm`);

  return new Response(JSON.stringify({ ok: true, timestamp: new Date().toISOString(), results }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
