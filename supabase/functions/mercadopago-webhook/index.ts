// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Supabase client with Service Role Key for secure database updates
const supabaseAdmin = createClient(
    // @ts-ignore
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url);
  const orderId = url.searchParams.get('order_id');
  const statusParam = url.searchParams.get('status');
  
  // Determine if this is a webhook notification or a user redirect (back_urls)
  const isRedirect = !!statusParam;

  // @ts-ignore
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string;

  try {
    // --- 1. Handle Webhook Notification (POST request from Mercado Pago) ---
    if (req.method === 'POST') {
      const body = await req.json();
      const topic = body.topic || body.type;
      const resourceId = body.data?.id || body.id;

      if (topic === 'payment' && resourceId) {
        // @ts-ignore
        const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
        
        const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
            headers: { 'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}` },
        });
        
        const paymentData = await paymentResponse.json();
        const externalReference = paymentData.external_reference; // Nosso order_id
        const paymentStatus = paymentData.status; 

        if (externalReference && paymentStatus === 'approved') {
            const order_id_int = parseInt(externalReference);
            
            // SEGURANÇA: Verificar se o pedido ainda está "Aguardando Pagamento"
            // Se já estiver "Cancelado", significa que o estoque já foi devolvido!
            const { data: order } = await supabaseAdmin
                .from('orders')
                .select('status')
                .eq('id', order_id_int)
                .single();

            if (order && order.status === 'Aguardando Pagamento') {
                const { error: finalizeError } = await supabaseAdmin.rpc('finalize_order_payment', { p_order_id: order_id_int });
                if (finalizeError) console.error(`[mercadopago-webhook] Error finalizing order ${order_id_int}:`, finalizeError);
                else console.log(`[mercadopago-webhook] Order ${order_id_int} finalized successfully.`);
            } else {
                console.warn(`[mercadopago-webhook] Payment received for order ${order_id_int} but status is ${order?.status}. Manual review needed.`);
                // Opcional: Notificar o admin aqui, pois o dinheiro entrou mas o estoque pode ter sido vendido para outro.
            }
        }
      }
      
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // --- 2. Handle User Redirect ---
    if (isRedirect && orderId) {
        const clientRedirectUrl = `${SUPABASE_URL}/confirmacao-pedido/${orderId}`;
        return Response.redirect(clientRedirectUrl, 303);
    }

    return new Response(JSON.stringify({ message: 'OK' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("[mercadopago-webhook] Global Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})