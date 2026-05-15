// redeploy: 2026-05-15T20:30:00Z — auth hook para interceptar emails nativos do Supabase via Resend
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0"

declare const Deno: any;

// Templates de email
const templates = {
  otp: (code: string) => `
    <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Código de Verificação</title></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f8fafc;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;padding:30px 0;border-bottom:3px solid #0ea5e9;">
          <div style="font-size:32px;font-weight:900;text-transform:uppercase;letter-spacing:-1px;">CLUB<span style="color:#0ea5e9;">DK</span></div>
        </div>
        <div style="padding:40px 20px;text-align:center;background:#fff;border-radius:0 0 12px 12px;">
          <h2 style="font-size:24px;margin-bottom:20px;color:#0f172a;">Seu Código de Verificação</h2>
          <p style="color:#64748b;">Use o código abaixo para confirmar sua conta:</p>
          <div style="background:#fff;border:2px solid #0ea5e9;color:#000;padding:25px;border-radius:12px;font-size:36px;font-weight:800;letter-spacing:8px;margin:30px auto;max-width:300px;">${code}</div>
          <p style="color:#64748b;margin-top:20px;">Este código expirará em 10 minutos.</p>
          <p style="color:#94a3b8;font-size:14px;">Se você não solicitou este código, pode ignorar este email.</p>
        </div>
        <div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;margin-top:10px;">
          <p>© ${new Date().getFullYear()} CLUB DK. Todos os direitos reservados.</p>
        </div>
      </div>
    </body></html>
  `,

  confirmEmail: (link: string) => `
    <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Confirme seu E-mail</title></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f8fafc;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;padding:30px 0;border-bottom:3px solid #0ea5e9;">
          <div style="font-size:32px;font-weight:900;text-transform:uppercase;letter-spacing:-1px;">CLUB<span style="color:#0ea5e9;">DK</span></div>
        </div>
        <div style="padding:40px 20px;text-align:center;background:#fff;border-radius:0 0 12px 12px;">
          <h2 style="font-size:24px;margin-bottom:20px;color:#0f172a;">Confirme seu E-mail</h2>
          <p style="color:#64748b;">Clique no botão abaixo para confirmar seu endereço de e-mail:</p>
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%);color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;margin:30px 0;">Confirmar E-mail</a>
          <p style="color:#64748b;margin-top:20px;font-size:13px;">Ou copie e cole este link no seu navegador:</p>
          <p style="color:#64748b;font-size:12px;word-break:break-all;">${link}</p>
          <p style="color:#94a3b8;font-size:14px;margin-top:20px;">Se você não criou uma conta, pode ignorar este email.</p>
        </div>
        <div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;margin-top:10px;">
          <p>© ${new Date().getFullYear()} CLUB DK. Todos os direitos reservados.</p>
        </div>
      </div>
    </body></html>
  `,

  passwordRecovery: (link: string) => `
    <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Redefinir Senha</title></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f8fafc;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;padding:30px 0;border-bottom:3px solid #0ea5e9;">
          <div style="font-size:32px;font-weight:900;text-transform:uppercase;letter-spacing:-1px;">CLUB<span style="color:#0ea5e9;">DK</span></div>
        </div>
        <div style="padding:40px 20px;text-align:center;background:#fff;border-radius:0 0 12px 12px;">
          <h2 style="font-size:24px;margin-bottom:20px;color:#0f172a;">Redefinir sua Senha</h2>
          <p style="color:#64748b;">Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo:</p>
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%);color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;margin:30px 0;">Redefinir Senha</a>
          <p style="color:#64748b;margin-top:20px;font-size:13px;">Ou copie e cole este link no seu navegador:</p>
          <p style="color:#64748b;font-size:12px;word-break:break-all;">${link}</p>
          <p style="color:#94a3b8;font-size:14px;margin-top:20px;">Este link expirará em 1 hora. Se você não solicitou esta redefinição, pode ignorar este email.</p>
        </div>
        <div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;margin-top:10px;">
          <p>© ${new Date().getFullYear()} CLUB DK. Todos os direitos reservados.</p>
        </div>
      </div>
    </body></html>
  `,

  magicLink: (link: string) => `
    <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Link de Acesso</title></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f8fafc;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;padding:30px 0;border-bottom:3px solid #0ea5e9;">
          <div style="font-size:32px;font-weight:900;text-transform:uppercase;letter-spacing:-1px;">CLUB<span style="color:#0ea5e9;">DK</span></div>
        </div>
        <div style="padding:40px 20px;text-align:center;background:#fff;border-radius:0 0 12px 12px;">
          <h2 style="font-size:24px;margin-bottom:20px;color:#0f172a;">Seu Link de Acesso</h2>
          <p style="color:#64748b;">Clique no botão abaixo para acessar sua conta:</p>
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%);color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;margin:30px 0;">Acessar Minha Conta</a>
          <p style="color:#64748b;margin-top:20px;font-size:13px;">Ou copie e cole este link no seu navegador:</p>
          <p style="color:#64748b;font-size:12px;word-break:break-all;">${link}</p>
          <p style="color:#94a3b8;font-size:14px;margin-top:20px;">Este link expirará em 1 hora.</p>
        </div>
        <div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;margin-top:10px;">
          <p>© ${new Date().getFullYear()} CLUB DK. Todos os direitos reservados.</p>
        </div>
      </div>
    </body></html>
  `,

  emailChange: (link: string) => `
    <!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Confirme Alteração de E-mail</title></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f8fafc;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;padding:30px 0;border-bottom:3px solid #0ea5e9;">
          <div style="font-size:32px;font-weight:900;text-transform:uppercase;letter-spacing:-1px;">CLUB<span style="color:#0ea5e9;">DK</span></div>
        </div>
        <div style="padding:40px 20px;text-align:center;background:#fff;border-radius:0 0 12px 12px;">
          <h2 style="font-size:24px;margin-bottom:20px;color:#0f172a;">Confirme a Alteração de E-mail</h2>
          <p style="color:#64748b;">Clique no botão abaixo para confirmar a alteração do seu endereço de e-mail:</p>
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%);color:white;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;margin:30px 0;">Confirmar Alteração</a>
          <p style="color:#64748b;margin-top:20px;font-size:13px;">Ou copie e cole este link no seu navegador:</p>
          <p style="color:#64748b;font-size:12px;word-break:break-all;">${link}</p>
          <p style="color:#94a3b8;font-size:14px;margin-top:20px;">Se você não solicitou esta alteração, entre em contato com o suporte imediatamente.</p>
        </div>
        <div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;margin-top:10px;">
          <p>© ${new Date().getFullYear()} CLUB DK. Todos os direitos reservados.</p>
        </div>
      </div>
    </body></html>
  `,
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'CLUB DK <noreply@dkcwb.com>'
    const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') || ''

    if (!apiKey) {
      console.error('[send-auth-hook] RESEND_API_KEY não configurado')
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const payload = await req.text()
    const headers = Object.fromEntries(req.headers)

    let user: any
    let email_data: any

    // Verificar assinatura do webhook se o secret estiver configurado
    if (hookSecret) {
      try {
        const secret = hookSecret.replace('v1,whsec_', '')
        const wh = new Webhook(secret)
        const verified = wh.verify(payload, headers) as any
        user = verified.user
        email_data = verified.email_data
        console.log('[send-auth-hook] assinatura verificada com sucesso')
      } catch (err) {
        console.error('[send-auth-hook] falha na verificação da assinatura:', err)
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } else {
      // Sem secret configurado, aceita sem verificação (menos seguro, mas funcional)
      console.warn('[send-auth-hook] SEND_EMAIL_HOOK_SECRET não configurado — aceitando sem verificação')
      const body = JSON.parse(payload)
      user = body.user
      email_data = body.email_data
    }

    if (!user?.email || !email_data) {
      console.error('[send-auth-hook] payload inválido')
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const toEmail = user.email
    const actionType = email_data.email_action_type
    const token = email_data.token || ''
    const tokenHash = email_data.token_hash || ''
    const siteUrl = (email_data.site_url || 'https://www.dkcwb.com').replace('http://localhost:9999', 'https://www.dkcwb.com')
    const redirectTo = email_data.redirect_to || siteUrl

    console.log('[send-auth-hook] processando:', { actionType, toEmail, siteUrl })

    let subject = ''
    let html = ''

    switch (actionType) {
      case 'signup': {
        const confirmLink = `${siteUrl}/auth/v1/verify?token=${tokenHash}&type=signup&redirect_to=${encodeURIComponent(redirectTo)}`
        subject = 'Confirme seu e-mail - CLUB DK'
        html = templates.confirmEmail(confirmLink)
        break
      }

      case 'recovery': {
        const recoveryLink = `${siteUrl}/auth/v1/verify?token=${tokenHash}&type=recovery&redirect_to=${encodeURIComponent(redirectTo)}`
        subject = 'Redefinir senha - CLUB DK'
        html = templates.passwordRecovery(recoveryLink)
        break
      }

      case 'magiclink': {
        const magicLink = `${siteUrl}/auth/v1/verify?token=${tokenHash}&type=magiclink&redirect_to=${encodeURIComponent(redirectTo)}`
        subject = 'Seu link de acesso - CLUB DK'
        html = templates.magicLink(magicLink)
        break
      }

      case 'invite': {
        const inviteLink = `${siteUrl}/auth/v1/verify?token=${tokenHash}&type=invite&redirect_to=${encodeURIComponent(redirectTo)}`
        subject = 'Você foi convidado - CLUB DK'
        html = templates.magicLink(inviteLink)
        break
      }

      case 'email_change': {
        // Secure email change: envia para o email atual (token) e novo email (token_new)
        const tokenNew = email_data.token_new || ''
        const tokenHashNew = email_data.token_hash_new || ''
        const newEmail = user.new_email || ''

        if (tokenHashNew && newEmail) {
          // Envia para o email atual (confirmação de saída)
          const currentLink = `${siteUrl}/auth/v1/verify?token=${tokenHashNew}&type=email_change&redirect_to=${encodeURIComponent(redirectTo)}`
          await sendEmail(apiKey, fromEmail, toEmail, 'Confirme a alteração de e-mail - CLUB DK', templates.emailChange(currentLink))

          // Envia para o novo email (confirmação de entrada)
          const newLink = `${siteUrl}/auth/v1/verify?token=${tokenHash}&type=email_change&redirect_to=${encodeURIComponent(redirectTo)}`
          await sendEmail(apiKey, fromEmail, newEmail, 'Confirme seu novo e-mail - CLUB DK', templates.emailChange(newLink))

          console.log('[send-auth-hook] email_change: enviado para', toEmail, 'e', newEmail)
          return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
        } else {
          // Sem secure email change: apenas um email para o novo endereço
          const changeLink = `${siteUrl}/auth/v1/verify?token=${tokenHash}&type=email_change&redirect_to=${encodeURIComponent(redirectTo)}`
          subject = 'Confirme seu novo e-mail - CLUB DK'
          html = templates.emailChange(changeLink)
        }
        break
      }

      case 'reauthentication': {
        subject = 'Código de verificação - CLUB DK'
        html = templates.otp(token)
        break
      }

      default: {
        console.warn('[send-auth-hook] tipo desconhecido:', actionType)
        subject = 'Verificação - CLUB DK'
        html = templates.otp(token || '------')
        break
      }
    }

    const result = await sendEmail(apiKey, fromEmail, toEmail, subject, html)
    if (!result.ok) {
      console.error('[send-auth-hook] falha ao enviar email:', result.error)
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('[send-auth-hook] email enviado com sucesso para:', toEmail, 'tipo:', actionType)
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('[send-auth-hook] erro inesperado:', err?.message || err)
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

async function sendEmail(apiKey: string, from: string, to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('[send-auth-hook] Resend error:', JSON.stringify(data), 'status:', res.status)
    return { ok: false, error: data?.message || 'Failed to send email' }
  }
  console.log('[send-auth-hook] Resend OK, id:', data?.id)
  return { ok: true }
}
