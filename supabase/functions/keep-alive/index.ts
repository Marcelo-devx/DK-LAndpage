// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Todas as edge functions que precisam ficar aquecidas
const FUNCTIONS_TO_WARM = [
  // Auth / cadastro / email — críticas para o fluxo de usuário
  'generate-token',
  'validate-token',
  'send-email-via-resend',
  'create-user',
  'forgot-password',
  'notify-password-change',
  'reset-user-password',
  'health-check',
  // Pedidos / pagamento
  'process-mercadopago-payment',
  'create-mercadopago-preference',
  'create-mercadopago-pix',
  'get-mercadopago-status',
  'mp-webhook',
  'update-order-status',
  'get-order-details',
  'admin-get-order-history',
  'admin-update-order',
  'admin-cancel-order',
  // Usuários / admin
  'get-users',
  'admin-create-user',
  'admin-delete-user',
  'bulk-add-points',
  // Integrações
  'n8n-webhook',
  'n8n-receive-order',
  'dispatch-webhook',
  'trigger-integration',
  // Cloudinary
  'cloudinary-upload',
  'cloudinary-list-images',
  'cloudinary-delete-image',
  'cloudinary-usage',
  // Outros
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
