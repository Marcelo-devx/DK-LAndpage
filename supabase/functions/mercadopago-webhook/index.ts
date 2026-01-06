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
        // Fetch payment details from Mercado Pago API
        // @ts-ignore
        const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
        
        const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
            headers: {
                'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
            },
        });
        
        const paymentData = await paymentResponse.json();
        const externalReference = paymentData.external_reference; // This is our order_id
        const paymentStatus = paymentData.status; // approved, pending, rejected

        if (externalReference && paymentStatus === 'approved') {
            const order_id_int = parseInt(externalReference);
            
            // Call RPC to finalize order (deduct stock, clear cart, award points, mark coupon used)
            const { error: finalizeError } = await supabaseAdmin.rpc('finalize_order_payment', { p_order_id: order_id_int });

            if (finalizeError) {
                console.error(`Error finalizing order ${order_id_int} via webhook:`, finalizeError);
                // Respond 200 to MP to avoid retries, but log the internal error
            } else {
                console.log(`Order ${order_id_int} finalized successfully via webhook.`);
            }
        }
      }
      
      // Always respond 200 OK to webhooks to acknowledge receipt
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // --- 2. Handle User Redirect (GET request from Mercado Pago back_urls) ---
    if (isRedirect && orderId) {
        // Redirect the user back to the client application status page
        // We use the hardcoded project ID in the client redirect URL
        const clientRedirectUrl = `${SUPABASE_URL}/confirmacao-pedido/${orderId}`;

        if (statusParam === 'success' || statusParam === 'approved') {
            // If successful, the webhook should have already finalized the order.
            // Redirect to the confirmation page.
            return Response.redirect(clientRedirectUrl, 303);
        } else if (statusParam === 'pending') {
            // If pending (e.g., boleto), redirect to confirmation page.
            return Response.redirect(clientRedirectUrl, 303);
        } else {
            // Failure/Rejected
            // Redirect to the confirmation page, which will show the status from the DB (likely 'Aguardando Pagamento' or 'Cancelado')
            return Response.redirect(clientRedirectUrl, 303);
        }
    }

    // Default response for unhandled GET requests
    return new Response(JSON.stringify({ message: 'Webhook or Redirect endpoint reached.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})