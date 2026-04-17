// redeploy: 2026-04-17T11:50:00Z — force redeploy fix 404
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getCorsHeaders, createPreflightResponse } from '../_shared/cors.ts'

serve(async (req) => {
  const requestId = crypto.randomUUID()
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') {
    return createPreflightResponse(origin)
  }

  // Health check — mantém a função aquecida
  const url = new URL(req.url)
  if (req.method === 'GET' && url.pathname.endsWith('/health')) {
    return new Response(JSON.stringify({ status: 'ok', function: 'process-mercadopago-payment', ts: Date.now() }), {
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  console.log(`[process-mercadopago-payment][${requestId}] ${req.method} ${req.url}`, { origin })

  try {
    // @ts-ignore
    const MP_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') as string;
    if (!MP_TOKEN) {
      console.error(`[process-mercadopago-payment][${requestId}] ERROR: MERCADOPAGO_ACCESS_TOKEN not configured`)
      return new Response(JSON.stringify({ error: "Chave de acesso do Mercado Pago não configurada no servidor." }), {
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json();

    console.log(`[process-mercadopago-payment][${requestId}] Payload recebido do Brick:`, JSON.stringify({
      external_reference: body.external_reference,
      transaction_amount: body.transaction_amount,
      payment_method_id: body.payment_method_id,
      installments: body.installments,
      has_token: !!body.token,
      payer_email: body.payer?.email,
    }))

    // O CardPayment Brick do MP envia estes campos:
    const {
      token,                  // card token gerado pelo Brick
      payment_method_id,      // ex: "visa", "master"
      installments,           // número de parcelas
      issuer_id,              // emissor do cartão
      external_reference,     // nosso order_id
      transaction_amount,     // valor total
      payer,                  // { email, identification: { type, number } }
    } = body

    if (!token) {
      console.error(`[process-mercadopago-payment][${requestId}] ERROR: Token do cartão não recebido`)
      throw new Error("Token do cartão não recebido. Tente novamente.")
    }
    if (!external_reference) {
      console.error(`[process-mercadopago-payment][${requestId}] ERROR: Referência do pedido não encontrada`)
      throw new Error("Referência do pedido não encontrada.")
    }
    if (!transaction_amount || transaction_amount <= 0) {
      console.error(`[process-mercadopago-payment][${requestId}] ERROR: Valor do pedido inválido: ${transaction_amount}`)
      throw new Error("Valor do pedido inválido.")
    }

    const orderId = parseInt(String(external_reference))
    if (isNaN(orderId)) {
      console.error(`[process-mercadopago-payment][${requestId}] ERROR: ID do pedido inválido: ${external_reference}`)
      throw new Error("ID do pedido inválido.")
    }

    console.log(`[process-mercadopago-payment][${requestId}] Processando pedido #${orderId}`)

    // Verificar se o pedido existe e está aguardando pagamento
    const { data: orderRow, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('id, status, total_price')
      .eq('id', orderId)
      .single()

    if (orderErr || !orderRow) {
      console.error(`[process-mercadopago-payment][${requestId}] ERROR: Pedido #${orderId} não encontrado`, orderErr)
      throw new Error(`Pedido #${orderId} não encontrado.`)
    }

    if (orderRow.status !== 'Aguardando Pagamento' && orderRow.status !== 'Pendente') {
      console.warn(`[process-mercadopago-payment][${requestId}] Pedido ${orderId} já está com status: ${orderRow.status}`)
      // Se já foi finalizado, retorna sucesso sem reprocessar
      if (orderRow.status === 'Em Preparação' || orderRow.status === 'Finalizada') {
        return new Response(JSON.stringify({ success: true, status: 'already_processed', order_id: orderId }), {
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
          status: 200,
        })
      }
    }

    // Usar o total_price do banco como fonte da verdade (evita manipulação)
    const finalAmount = Number(orderRow.total_price || transaction_amount)

    const paymentPayload: any = {
      token,
      payment_method_id,
      installments: Number(installments) || 1,
      transaction_amount: Number(finalAmount.toFixed(2)),
      external_reference: String(orderId),
      statement_descriptor: "DKCWB",
      payer: {
        email: payer?.email || '',
        identification: payer?.identification || {},
        first_name: payer?.first_name || '',
        last_name: payer?.last_name || '',
      },
    }

    // Adicionar issuer_id apenas se presente (alguns cartões não têm)
    if (issuer_id) paymentPayload.issuer_id = issuer_id

    console.log(`[process-mercadopago-payment][${requestId}] Enviando para API do MP:`, {
      payment_method_id,
      installments: paymentPayload.installments,
      transaction_amount: paymentPayload.transaction_amount,
      external_reference: paymentPayload.external_reference,
    })

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `dkcwb-${orderId}-${Date.now()}`
      },
      body: JSON.stringify(paymentPayload),
    })

    const paymentData = await mpResponse.json()

    console.log(`[process-mercadopago-payment][${requestId}] Resposta do MP:`, {
      status: paymentData.status,
      status_detail: paymentData.status_detail,
      id: paymentData.id,
    })

    if (!mpResponse.ok) {
      const errorMessage = paymentData.cause?.[0]?.description || paymentData.message || 'Pagamento recusado.'
      console.error(`[process-mercadopago-payment][${requestId}] Erro da API do MP:`, JSON.stringify(paymentData))
      throw new Error(errorMessage)
    }

    // Registrar log da tentativa
    try {
      await supabaseAdmin.from('integration_logs').insert([{
        event_type: 'mercadopago_payment_attempt',
        status: paymentData.status,
        details: `payment_id=${paymentData.id} status=${paymentData.status} detail=${paymentData.status_detail}`,
        payload: { payment_id: paymentData.id, order_id: orderId, status: paymentData.status, status_detail: paymentData.status_detail }
      }])
    } catch (e) { /* ignora erros de log */ }

    if (paymentData.status === 'approved') {
      console.log(`[process-mercadopago-payment][${requestId}] Pagamento APROVADO para pedido: ${orderId}. Finalizando...`)

      const { error: finalizeError } = await supabaseAdmin.rpc('finalize_order_payment', {
        p_order_id: orderId
      })

      if (finalizeError) {
        console.error(`[process-mercadopago-payment][${requestId}] Erro ao finalizar pedido ${orderId}:`, finalizeError)
        // Pagamento aprovado mas banco falhou — logar para conciliação manual
        try {
          await supabaseAdmin.from('integration_logs').insert([{
            event_type: 'mercadopago_finalize_error',
            status: 'error',
            details: `Pagamento aprovado mas finalize_order_payment falhou: ${finalizeError.message}`,
            payload: { payment_id: paymentData.id, order_id: orderId }
          }])
        } catch (e) { /* ignora */ }
      } else {
        console.log(`[process-mercadopago-payment][${requestId}] Pedido ${orderId} finalizado com sucesso.`)
      }

      return new Response(JSON.stringify({
        success: true,
        status: paymentData.status,
        payment_id: paymentData.id,
        order_id: orderId,
      }), {
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        status: 200,
      })

    } else if (paymentData.status === 'in_process' || paymentData.status === 'pending') {
      // Pagamento em análise — comum em alguns cartões
      console.warn(`[process-mercadopago-payment][${requestId}] Pagamento em análise para pedido ${orderId}: ${paymentData.status_detail}`)
      return new Response(JSON.stringify({
        success: false,
        status: paymentData.status,
        error: 'Seu pagamento está em análise. Você receberá uma confirmação em breve.',
        payment_id: paymentData.id,
        order_id: orderId,
      }), {
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        status: 200,
      })

    } else {
      // Recusado
      const detail = paymentData.status_detail || paymentData.status
      const friendlyMessages: Record<string, string> = {
        'cc_rejected_insufficient_amount': 'Saldo insuficiente no cartão.',
        'cc_rejected_bad_filled_card_number': 'Número do cartão incorreto.',
        'cc_rejected_bad_filled_date': 'Data de validade incorreta.',
        'cc_rejected_bad_filled_security_code': 'Código de segurança incorreto.',
        'cc_rejected_blacklist': 'Cartão não autorizado.',
        'cc_rejected_call_for_authorize': 'Ligue para o banco para autorizar.',
        'cc_rejected_card_disabled': 'Cartão desativado. Contate seu banco.',
        'cc_rejected_duplicated_payment': 'Pagamento duplicado detectado.',
        'cc_rejected_high_risk': 'Pagamento recusado por segurança.',
        'cc_rejected_max_attempts': 'Limite de tentativas atingido. Tente outro cartão.',
      }

      const userMessage = friendlyMessages[detail] || `Pagamento recusado: ${detail}`
      console.warn(`[process-mercadopago-payment][${requestId}] Pagamento recusado para pedido ${orderId}: ${detail}`)

      throw new Error(userMessage)
    }

  } catch (error: any) {
    console.error(`[process-mercadopago-payment][${requestId}] Erro fatal:`, error?.message || error)
    return new Response(JSON.stringify({
      success: false,
      error: error?.message || 'Erro ao processar pagamento. Tente novamente.'
    }), {
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})