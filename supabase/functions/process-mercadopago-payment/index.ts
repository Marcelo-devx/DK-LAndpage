// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // @ts-ignore
    const MP_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') as string;
    if (!MP_TOKEN) {
      throw new Error("Chave de acesso do Mercado Pago não configurada no servidor.");
    }

    const supabaseAdmin = createClient(
        // @ts-ignore
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      token,
      issuer_id,
      payment_method_id,
      transaction_amount,
      installments,
      payer,
      external_reference // Este é o nosso order_id
    } = await req.json();

    console.log(`[process-mp-payment] Recebido pagamento para pedido: ${external_reference}`);

    const paymentPayload = {
      token,
      issuer_id,
      payment_method_id,
      transaction_amount,
      installments,
      payer,
      external_reference,
      statement_descriptor: "DKCWB",
    };

    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `dkcwb-${external_reference}-${Date.now()}`
      },
      body: JSON.stringify(paymentPayload),
    });

    const paymentData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago API Error:", JSON.stringify(paymentData));
      const errorMessage = paymentData.cause?.[0]?.description || paymentData.message || 'Pagamento recusado.';
      throw new Error(errorMessage);
    }

    if (paymentData.status === 'approved') {
      console.log(`[process-mp-payment] Pagamento APROVADO para pedido: ${external_reference}. Finalizando...`);
      const { error: finalizeError } = await supabaseAdmin.rpc('finalize_order_payment', { 
        p_order_id: parseInt(external_reference) 
      });

      if (finalizeError) {
        console.error(`[process-mp-payment] Erro ao finalizar pedido ${external_reference} no banco:`, finalizeError);
        // O pagamento foi aprovado, mas o banco falhou. Isso requer atenção manual.
        // Poderíamos logar isso em uma tabela de "pagamentos a conciliar".
      }
    } else {
      console.warn(`[process-mp-payment] Pagamento para pedido ${external_reference} com status: ${paymentData.status}. Detalhe: ${paymentData.status_detail}`);
      throw new Error(`Pagamento ${paymentData.status_detail}`);
    }

    return new Response(JSON.stringify({ success: true, status: paymentData.status, order_id: external_reference }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[process-mp-payment] Erro fatal:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Usar 400 para erros de negócio/validação
    });
  }
});