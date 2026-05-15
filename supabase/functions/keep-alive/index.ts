// redeploy: 2026-05-15T15:00:00Z — keep only canonical current functions
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Mantém apenas funções canônicas e atuais.
// Evita aquecer aliases antigos ou endpoints removidos que geravam ruído,
// erros espúrios e risco de containers legados permanecerem vivos.
const CURRENT_FUNCTIONS = [
  // Checkout / pedidos
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

  // Auth / conta
  'send-email-via-resend',
  'send-auth-hook',
  'generate-token',
  'validate-token',
  'create-user',
  'forgot-password',
  'change-password',
  'notify-password-change',
  'reset-user-password',
  'update-password-admin',

  // Utilitários usados no app
  'find-order-by-phone',
  'validate-cep',
  'health-check',
  'chat-proxy',
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

  await Promise.allSettled(
    CURRENT_FUNCTIONS.map(async (fn) => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
          method: 'OPTIONS',
          headers: {
            'apikey': anonKey,
          },
          signal: AbortSignal.timeout(8000),
        });

        const ok = res.status === 200 || res.status === 204;
        results[fn] = ok ? 'warm' : `status:${res.status}`;
        console.log(`[keep-alive] ${fn} -> ${results[fn]}`);
      } catch (err: any) {
        results[fn] = `error:${err?.message || 'unknown'}`;
        console.warn(`[keep-alive] ${fn} -> error:`, err?.message);
      }
    })
  );

  const warm = Object.values(results).filter((v) => v === 'warm').length;
  console.log(`[keep-alive] Concluído: ${warm}/${CURRENT_FUNCTIONS.length} warm`);

  return new Response(JSON.stringify({ ok: true, timestamp: new Date().toISOString(), results }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
