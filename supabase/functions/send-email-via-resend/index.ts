// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  // New template for complete profile flow
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
          <h2 style="font-size: 24px; margin-bottom: 20px; color: #0f172a;">Complete seu Cadastro</h2>
          <p style="color: #64748b;">Olá ${email}, clique no botão abaixo para completar seu cadastro e criar sua senha:</p>
          
          <a href="${completeLink}" class="button">Completar Cadastro</a>
          
          <p style="color: #64748b; margin-top: 20px;">Ou copie e cole este link no seu navegador:</p>
          <p style="color: #64748b; font-size: 12px; word-break: break-all;">${completeLink}</p>
          
          <p style="color: #64748b; margin-top: 20px;">Este link expirará em 24 horas.</p>
          <p class="info">Se você não solicitou este cadastro, pode ignorar este email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} CLUB DK. Todos os direitos reservados.</p>
        </div>
      </div>
    </body>
    </html>
  `,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log('[send-email-via-resend] Received request')

  try {
    const { to, subject, html, type, code, resetLink, completeLink } = await req.json()

    // Validate required fields
    if (!to || !subject) {
      console.error('[send-email-via-resend] Missing required fields', { to, subject })
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get environment variables
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@clubdk.com.br'

    if (!resendApiKey) {
      console.error('[send-email-via-resend] RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('[send-email-via-resend] Sending email', { to, subject, type })

    // Use template if type is provided
    let emailHtml = html
    if (type === 'otp' && code) {
      emailHtml = templates.otp(code)
      console.log('[send-email-via-resend] Using OTP template')
    } else if (type === 'password_reset' && resetLink) {
      emailHtml = templates.passwordReset(resetLink)
      console.log('[send-email-via-resend] Using password reset template')
    } else if (type === 'complete_profile' && completeLink) {
      emailHtml = templates.completeProfile(completeLink, to)
      console.log('[send-email-via-resend] Using complete profile template')
    }

    // Send email via Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: subject,
        html: emailHtml,
      }),
    })

    const responseData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error('[send-email-via-resend] Resend API error', responseData)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: responseData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log('[send-email-via-resend] Email sent successfully', responseData)

    return new Response(
      JSON.stringify({ success: true, messageId: responseData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('[send-email-via-resend] Unexpected error', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})