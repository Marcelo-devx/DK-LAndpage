// redeploy: 2026-04-27T03:00:00Z — force redeploy was 404
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  console.log('[notify-password-change] request received')

  let body: any
  try {
    body = await req.json()
  } catch (err) {
    console.error('[notify-password-change] invalid json body', { error: String(err) })
    return new Response('Bad Request', { status: 400, headers: corsHeaders })
  }

  const email = body?.email
  const name = body?.name || ''

  if (!email) {
    console.error('[notify-password-change] missing email')
    return new Response('Missing email', { status: 400, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[notify-password-change] missing supabase env vars')
    return new Response('Server not configured', { status: 500, headers: corsHeaders })
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-email-via-resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({
        to: email,
        subject: 'Sua senha foi alterada com sucesso - CLUB DK',
        type: 'password_changed',
        name,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[notify-password-change] send-email-via-resend error', { status: res.status, body: errText })
      return new Response('Failed to send email', { status: 502, headers: corsHeaders })
    }

    console.log('[notify-password-change] email de notificação enviado com sucesso', { to: email })
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('[notify-password-change] unexpected error', { error: String(err) })
    return new Response('Internal error', { status: 500, headers: corsHeaders })
  }
})
