// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Todas as funções são aquecidas via OPTIONS.
// OPTIONS nunca executa lógica de negócio nem autenticação — apenas retorna
// os headers CORS e mantém o container vivo sem gerar erros de auth.
const ALL_FUNCTIONS = [
  // Críticas para o usuário final
  'trigger-integration',
  'update-order-status',
  'get-order-details',
  'get-order-public',
  'mercadopago-webhook',
  'process-mercadopago-payment',
  'send-order-email',
  // Auth / cadastro
  'send-email-via-resend',
  'generate-token',
  'validate-token',
  'create-user',
  'forgot-password',
  'change-password',
  'notify-password-change',
  'reset-user-password',
  'update-password-admin',
  // Pagamento
  'create-mercadopago-preference',
  'create-mp-preference',
  'create-mercadopago-pix',
  'get-mercadopago-status',
  'mp-webhook',
  // Admin
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
  // Integrações
  'n8n-webhook',
  'n8n-receive-order',
  'dispatch-webhook',
  'log-integration',
  // Nota: 'api-config-manager' removido — tabela api_configs não existe
  // Cloudinary
  'cloudinary-upload',
  'cloudinary-list-images',
  'cloudinary-delete-image',
  'cloudinary-usage',
  // Outros
  'health-check',
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

  // Aquece TODAS as funções via OPTIONS — nunca dispara auth nem lógica de negócio
  await Promise.allSettled(
    ALL_FUNCTIONS.map(async (fn) => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
          method: 'OPTIONS',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
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

  const warm = Object.values(results).filter(v => v === 'warm').length;
  console.log(`[keep-alive] Concluído: ${warm}/${ALL_FUNCTIONS.length} warm`);

  return new Response(JSON.stringify({ ok: true, timestamp: new Date().toISOString(), results }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
