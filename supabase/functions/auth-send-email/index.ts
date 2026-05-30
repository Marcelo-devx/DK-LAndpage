// redeploy: 2026-05-30T02:10:00Z — force redeploy v2 suppress native recovery email
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { user, email_data } = body

    const emailType = email_data?.email_action_type || ''
    const userEmail = user?.email || ''

    console.log('[auth-send-email] hook chamado:', JSON.stringify({ emailType, userEmail, hasUser: !!user }))

    // Tipos de email que o Supabase pode enviar nativamente:
    // signup, recovery, invite, magiclink, email_change, reauthentication

    // Para o tipo "recovery" (reset de senha), NÃO enviamos o email nativo do Supabase.
    // O nosso fluxo de "forgot-password" já envia a senha temporária via Resend.
    // Retornamos sucesso sem fazer nada para suprimir o email nativo.
    if (emailType === 'recovery') {
      console.log('[auth-send-email] tipo recovery interceptado — suprimindo email nativo do Supabase para:', userEmail)
      return new Response(JSON.stringify({ success: true, suppressed: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Para outros tipos (signup, invite, etc.), deixamos o Supabase enviar normalmente
    // retornando null/vazio para que o Supabase use o comportamento padrão
    console.log('[auth-send-email] tipo', emailType, '— deixando Supabase enviar normalmente')
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('[auth-send-email] erro inesperado:', err?.message || err)
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
