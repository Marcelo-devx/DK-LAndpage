// redeploy: 2026-04-27T02:00:00Z — created, was missing from repo
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

declare const Deno: any

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://jrlozhhvwqfmjtkmvukf.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'CLUB DK <noreply@dkcwb.com>'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function buildEmailHtml(eventType: string, order: any, items: any[]): { subject: string; html: string } {
  const orderId = order?.id || '?'
  const total = Number(order?.total_price || 0).toFixed(2).replace('.', ',')
  const customerName = order?.shipping_address?.first_name || 'Cliente'

  const itemsHtml = items.map((i: any) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${i.name_at_purchase || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;">${i.quantity || 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;">R$ ${Number(i.price_at_purchase || 0).toFixed(2).replace('.', ',')}</td>
    </tr>
  `).join('')

  const baseStyle = `
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;margin:0;padding:0;}
    .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);}
    .header{background:#0ea5e9;padding:32px 24px;text-align:center;}
    .logo{color:#fff;font-size:28px;font-weight:900;letter-spacing:-1px;text-transform:uppercase;}
    .logo span{color:#bae6fd;}
    .body{padding:32px 24px;}
    .badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;}
    table{width:100%;border-collapse:collapse;}
    th{background:#f8fafc;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#94a3b8;letter-spacing:.05em;}
    .total-row td{padding:12px;font-weight:700;font-size:18px;color:#0ea5e9;}
    .footer{background:#f8fafc;padding:20px 24px;text-align:center;color:#94a3b8;font-size:12px;}
  `

  if (eventType === 'order_paid') {
    return {
      subject: `✅ Pedido #${orderId} confirmado — CLUB DK`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyle}</style></head><body>
        <div class="wrap">
          <div class="header"><div class="logo">CLUB<span>DK</span></div></div>
          <div class="body">
            <p style="color:#64748b;margin-bottom:4px;">Olá, <strong>${customerName}</strong>!</p>
            <h2 style="margin:0 0 16px;color:#0f172a;">Seu pagamento foi confirmado 🎉</h2>
            <p style="color:#64748b;">Pedido <strong>#${orderId}</strong> está em preparação.</p>
            <table style="margin:24px 0;">
              <thead><tr><th>Produto</th><th style="text-align:center;">Qtd</th><th style="text-align:right;">Valor</th></tr></thead>
              <tbody>${itemsHtml}</tbody>
              <tfoot><tr class="total-row"><td colspan="2">Total</td><td style="text-align:right;">R$ ${total}</td></tr></tfoot>
            </table>
            <p style="color:#64748b;font-size:14px;">Assim que seu pedido for embalado, você receberá outra notificação.</p>
          </div>
          <div class="footer">© ${new Date().getFullYear()} CLUB DK. Todos os direitos reservados.</div>
        </div>
      </body></html>`
    }
  }

  if (eventType === 'order_packed') {
    return {
      subject: `📦 Pedido #${orderId} embalado e pronto — CLUB DK`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyle}</style></head><body>
        <div class="wrap">
          <div class="header"><div class="logo">CLUB<span>DK</span></div></div>
          <div class="body">
            <p style="color:#64748b;margin-bottom:4px;">Olá, <strong>${customerName}</strong>!</p>
            <h2 style="margin:0 0 16px;color:#0f172a;">Seu pedido está embalado 📦</h2>
            <p style="color:#64748b;">Pedido <strong>#${orderId}</strong> foi embalado e está aguardando entrega.</p>
            <table style="margin:24px 0;">
              <thead><tr><th>Produto</th><th style="text-align:center;">Qtd</th><th style="text-align:right;">Valor</th></tr></thead>
              <tbody>${itemsHtml}</tbody>
              <tfoot><tr class="total-row"><td colspan="2">Total</td><td style="text-align:right;">R$ ${total}</td></tr></tfoot>
            </table>
            <p style="color:#64748b;font-size:14px;">Em breve nosso entregador estará a caminho!</p>
          </div>
          <div class="footer">© ${new Date().getFullYear()} CLUB DK. Todos os direitos reservados.</div>
        </div>
      </body></html>`
    }
  }

  if (eventType === 'order_cancelled') {
    return {
      subject: `❌ Pedido #${orderId} foi cancelado — CLUB DK`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseStyle}</style></head><body>
        <div class="wrap">
          <div class="header" style="background:#ef4444;"><div class="logo">CLUB<span>DK</span></div></div>
          <div class="body">
            <p style="color:#64748b;margin-bottom:4px;">Olá, <strong>${customerName}</strong>!</p>
            <h2 style="margin:0 0 16px;color:#0f172a;">Pedido #${orderId} cancelado</h2>
            <p style="color:#64748b;">Seu pedido foi cancelado. Se tiver dúvidas, entre em contato com nosso suporte pelo WhatsApp.</p>
          </div>
          <div class="footer">© ${new Date().getFullYear()} CLUB DK. Todos os direitos reservados.</div>
        </div>
      </body></html>`
    }
  }

  return {
    subject: `Atualização do Pedido #${orderId} — CLUB DK`,
    html: `<p>Seu pedido #${orderId} foi atualizado.</p>`
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  const requestId = crypto.randomUUID()
  console.log(`[send-order-email][${requestId}] ${req.method} ${req.url}`)

  try {
    if (!RESEND_API_KEY) {
      console.error(`[send-order-email][${requestId}] RESEND_API_KEY not configured`)
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let body: any = {}
    try { body = await req.json() } catch { body = {} }

    const { event_type, order_id } = body

    if (!event_type || !order_id) {
      console.error(`[send-order-email][${requestId}] missing event_type or order_id`)
      return new Response(JSON.stringify({ error: 'event_type e order_id são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[send-order-email][${requestId}] event=${event_type} order=${order_id}`)

    // Buscar pedido
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, total_price, shipping_cost, donation_amount, status, payment_method, shipping_address, guest_email, user_id')
      .eq('id', Number(order_id))
      .single()

    if (orderErr || !order) {
      console.error(`[send-order-email][${requestId}] order not found`, orderErr)
      return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Buscar itens
    const { data: items } = await supabase
      .from('order_items')
      .select('name_at_purchase, quantity, price_at_purchase')
      .eq('order_id', Number(order_id))

    // Resolver email do cliente
    let toEmail: string | null = order.shipping_address?.email || order.guest_email || null

    if (!toEmail && order.user_id) {
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(order.user_id)
        toEmail = authUser?.user?.email || null
      } catch (e) {
        console.warn(`[send-order-email][${requestId}] could not resolve email for user`, order.user_id)
      }
    }

    if (!toEmail) {
      console.warn(`[send-order-email][${requestId}] no email found for order ${order_id}, skipping`)
      return new Response(JSON.stringify({ success: false, reason: 'no_email' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { subject, html } = buildEmailHtml(event_type, order, items || [])

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [toEmail], subject, html }),
    })

    const resendData = await resendResp.json()

    if (!resendResp.ok) {
      console.error(`[send-order-email][${requestId}] Resend error`, resendData)
      // Log no banco
      await supabase.from('integration_logs').insert({
        event_type: `email_${event_type}`,
        status: 'error',
        details: `Pedido #${order_id} | Para: ${toEmail} | Erro: ${resendData?.message || 'unknown'}`,
        response_code: resendResp.status,
      }).catch(() => {})
      return new Response(JSON.stringify({ error: resendData?.message || 'Resend error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[send-order-email][${requestId}] sent ${event_type} to ${toEmail} | Resend ID: ${resendData?.id}`)

    // Log no banco
    await supabase.from('integration_logs').insert({
      event_type: `email_${event_type}`,
      status: 'success',
      details: `Pedido #${order_id} | Para: ${toEmail} | Assunto: ${subject} | Resend ID: ${resendData?.id}`,
      response_code: 200,
    }).catch(() => {})

    return new Response(JSON.stringify({ success: true, resend_id: resendData?.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error(`[send-order-email][${requestId}] unhandled error`, err)
    return new Response(JSON.stringify({ error: err?.message || 'internal_error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
