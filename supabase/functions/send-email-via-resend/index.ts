// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

// @ts-ignore
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Vary': 'Origin',
}

if (typeof globalThis.atob !== 'function') {
  globalThis.atob = (value: string) => Buffer.from(value, 'base64').toString('binary') as any;
}

// Email templates
const templates = {
  otp: (code: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Seu Código de Verificação</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 30px 0; border-bottom: 3px solid #0ea5e9; }
        .logo { font-size: 32px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; }
        .logo span { color: #0ea5e9; }
        .content { padding: 40px 20px; text-align: center; }
        .code-box { 
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          color: white; 
          padding: 25px; 
          border-radius: 12px; 
          font-size: 36px; 
          font-weight: 800; 
          letter-spacing: 8px;
          margin: 30px auto;
          max-width: 300px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .info { color: #64748b; font-size: 14px; margin-top: 20px; }
        .footer { text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">CLUB<span>DK</span></div>
        </div>
        <div class="content">
          <h2 style="font-size: 24px; margin-bottom: 20px; color: #0f172a;">Seu Código de Verificação</h2>
          <p style="color: #64748b;">Use o código abaixo para confirmar sua conta:</p>
          
          <div class="code-box">${code}</div>
          
          <p style="color: #64748b; margin-top: 20px;">Este código expirará em 10 minutos.</p>
          <p class="info">Se você não solicitou este código, pode ignorar este email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} CLUB DK. Todos os direitos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `,
  passwordReset: (resetLink: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Redefinir sua Senha</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 30px 0; border-bottom: 3px solid #0ea5e9; }
        .logo { font-size: 32px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; }
        .logo span { color: #0ea5e9; }
        .content { padding: 40px 20px; text-align: center; }
        .button { 
          display: inline-block;
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          color: white; 
          padding: 16px 32px; 
          border-radius: 8px; 
          text-decoration: none;
          font-weight: 700;
          font-size: 16px;
          margin: 30px 0;
          box-shadow: 0 4px 6px rgba(14, 165, 233, 0.3);
        }
        .info { color: #64748b; font-size: 14px; margin-top: 20px; }
        .footer { text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">CLUB<span>DK</span></div>
        </div>
        <div class="content">
          <h2 style="font-size: 24px; margin-bottom: 20px; color: #0f172a;">Redefinir sua Senha</h2>
          <p style="color: #64748b;">Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:</p>
          
          <a href="${resetLink}" class="button">Redefinir Senha</a>
          
          <p style="color: #64748b; margin-top: 20px;">Ou copie e cole este link no seu navegador:</p>
          <p style="color: #64748b; font-size: 12px; word-break: break-all;">${resetLink}</p>
          
          <p style="color: #64748b; margin-top: 20px;">Este link expirará em 1 hora.</p>
          <p class="info">Se você não solicitou esta redefinição, pode ignorar este email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} CLUB DK. Todos os direitos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `,
  newPassword: (password: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sua Nova Senha</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 30px 0; border-bottom: 3px solid #0ea5e9; }
        .logo { font-size: 32px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; }
        .logo span { color: #0ea5e9; }
        .content { padding: 40px 20px; text-align: center; }
        .password-box {
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          background-color: #0ea5e9;
          color: #0f172a;
          padding: 25px 30px;
          border-radius: 12px;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: 4px;
          margin: 30px auto;
          max-width: 320px;
          text-shadow: 1px 1px 3px rgba(0,0,0,0.02);
          word-break: break-all;
        }
        .info { color: #64748b; font-size: 14px; margin-top: 20px; }
        .warning { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px 16px; color: #92400e; font-size: 13px; margin-top: 20px; }
        .footer { text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">CLUB<span>DK</span></div>
        </div>
        <div class="content">
          <h2 style="font-size: 24px; margin-bottom: 10px; color: #0f172a;">Sua Nova Senha</h2>
          <p style="color: #64748b;">Conforme solicitado, geramos uma nova senha para sua conta:</p>
          <div class="password-box" style="color:#0f172a; background-color:#0ea5e9;">${password}</div>
          <p style="color:#0f172a; font-size:20px; font-weight:800; margin-top:10px;">Senha: ${password}</p>
          <p style="color: #64748b;">Use essa senha para acessar o site. Após entrar, você pode alterá-la novamente na área de segurança do seu dashboard.</p>
          <div class="warning">⚠️ Por segurança, não compartilhe essa senha com ninguém. Se você não solicitou essa alteração, entre em contato conosco imediatamente.</div>
        </div>
        <div class="footer"><p>© ${new Date().getFullYear()} CLUB DK. Todos os direitos reservados.</p></div>
      </div>
    </body>
    </html>
  `,
  completeProfile: (completeLink: string, email: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Complete seu Cadastro</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 30px 0; border-bottom: 3px solid #0ea5e9; }
        .logo { font-size: 32px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; }
        .logo span { color: #0ea5e9; }
        .content { padding: 40px 20px; text-align: center; }
        .button { display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; margin: 30px 0; box-shadow: 0 4px 6px rgba(14, 165, 233, 0.3); }
        .info { color: #64748b; font-size: 14px; margin-top: 20px; }
        .footer { text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><div class="logo">CLUB<span>DK</span></div></div>
        <div class="content">
          <h2 style="font-size: 24px; margin-bottom: 20px; color: #0f172a;">Complete seu Cadastro</h2>
          <p style="color: #64748b;">Olá ${email}, clique no botão abaixo para completar seu cadastro e criar sua senha:</p>
          <a href="${completeLink}" class="button">Completar Cadastro</a>
          <p style="color: #64748b; margin-top: 20px;">Ou copie e cole este link no seu navegador:</p>
          <p style="color: #64748b; font-size: 12px; word-break: break-all;">${completeLink}</p>
          <p style="color: #64748b; margin-top: 20px;">Este link expirará em 24 horas.</p>
          <p class="info">Se você não solicitou este cadastro, pode ignorar este email.</p>
        </div>
        <div class="footer"><p>© ${new Date().getFullYear()} CLUB DK. Todos os direitos reservados.</p></div>
      </div>
    </body>
    </html>
  `,
  passwordChanged: (name: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Senha Alterada com Sucesso</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 30px 0; border-bottom: 3px solid #0ea5e9; }
        .logo { font-size: 32px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; }
        .logo span { color: #0ea5e9; }
        .content { padding: 40px 20px; text-align: center; }
        .icon-box { width: 72px; height: 72px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 36px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header"><div class="logo">CLUB<span>DK</span></div></div>
        <div class="content">
          <div class="icon-box">✓</div>
          <h2 style="font-size: 24px; margin-bottom: 10px; color: #0f172a;">Senha Alterada</h2>
          <p style="color: #64748b;">Olá ${name}, sua senha foi alterada com sucesso.</p>
        </div>
      </div>
    </body>
    </html>
  `,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'CLUB DK <onboarding@resend.dev>'

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { to, subject, type, code, resetLink, html } = body

    if (!to || !subject) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let emailHtml = html || ''
    if (!emailHtml) {
      switch (type) {
        case 'otp':
          emailHtml = templates.otp(code || '')
          break
        case 'password_reset':
          emailHtml = templates.passwordReset(resetLink || '')
          break
        case 'new_password':
          emailHtml = templates.newPassword(code || '')
          break
        case 'complete_profile':
          emailHtml = templates.completeProfile(resetLink || '#', to)
          break
        case 'password_changed':
          emailHtml = templates.passwordChanged(code || 'Usuário')
          break
        default:
          emailHtml = templates.otp(code || '')
      }
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: emailHtml,
      }),
    })

    const responseData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('[send-email-via-resend] Resend API error:', responseData)
      return new Response(JSON.stringify({ error: responseData?.message || 'Failed to send email' }), {
        status: resendResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[send-email-via-resend] Email sent successfully to', to)
    return new Response(JSON.stringify({ success: true, data: responseData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[send-email-via-resend] unexpected error', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})