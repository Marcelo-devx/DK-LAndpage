import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
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

  // Read secrets (set these in Supabase Console: Edge Functions -> Manage Secrets)
  const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || ''
  const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN') || ''
  const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL') || `no-reply@${MAILGUN_DOMAIN}`

  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    console.error('[notify-password-change] missing mailgun secrets')
    return new Response('Email service not configured', { status: 500, headers: corsHeaders })
  }

  // Build email content
  const subject = 'Sua senha foi alterada com sucesso'
  const text = `Olá ${name || ''},\n\nEsta é uma confirmação de que sua senha foi alterada com sucesso. Se você não realizou esta alteração, por favor entre em contato com o suporte imediatamente.`
  const html = `<p>Olá ${name || ''},</p><p>Esta é uma confirmação de que sua senha foi alterada com sucesso. Se você não realizou esta alteração, por favor entre em contato com o suporte imediatamente.</p>`

  try {
    const form = new FormData()
    form.append('from', SENDER_EMAIL)
    form.append('to', email)
    form.append('subject', subject)
    form.append('text', text)
    form.append('html', html)

    const res = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('api:' + MAILGUN_API_KEY),
      },
      body: form,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[notify-password-change] mailgun error', { status: res.status, body: errText })
      return new Response('Failed to send email', { status: 502, headers: corsHeaders })
    }

    console.log('[notify-password-change] email sent', { to: email })
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('[notify-password-change] unexpected error', { error: String(err) })
    return new Response('Internal error', { status: 500, headers: corsHeaders })
  }
})
