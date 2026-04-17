// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  const hasSupabaseUrl = !!Deno.env.get('SUPABASE_URL')
  const hasServiceRole = !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const hasResendKey = !!Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || '(not set - using onboarding@resend.dev)'

  console.log('[health-check] env check:', { hasSupabaseUrl, hasServiceRole, hasResendKey, fromEmail })

  return new Response(JSON.stringify({
    ok: true,
    timestamp: new Date().toISOString(),
    env: {
      SUPABASE_URL: hasSupabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: hasServiceRole,
      RESEND_API_KEY: hasResendKey,
      RESEND_FROM_EMAIL: fromEmail,
    }
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
