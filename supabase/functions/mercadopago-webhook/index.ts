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
  // This function should only handle POST requests from Mercado Pago
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    })
  }

  try {
    const body = await req.json();
    const topic = body.topic || body.type;
    const resourceId = body.data?.id || body.id;

    // @ts-ignore
    const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') as string;

    if (topic === 'payment' && resourceId) {
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
          headers: { 'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}` },
      });
      
      const paymentData = await paymentResponse.json();
      const externalReference = paymentData.external_reference;
      const paymentStatus = paymentData.status; 

      if (externalReference && paymentStatus === 'approved') {
          const order_id_int = parseInt(externalReference);
          
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
          }
      }
    }
    
    return new Response(JSON.stringify({ received: true }), {
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