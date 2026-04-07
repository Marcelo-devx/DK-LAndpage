// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getCorsHeaders, createPreflightResponse } from '../_shared/cors.ts'

serve(async (req) => {
  const requestId = crypto.randomUUID()
  const origin = req.headers.get('origin')
  console.log(`[get-order-public][${requestId}] ${req.method} ${req.url}`, { origin })

  if (req.method === 'OPTIONS') {
    return createPreflightResponse(origin)
  }

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = body.order_id || body.id || null;
    if (!orderId) {
      return new Response(JSON.stringify({ success: false, error: 'order_id is required' }), {
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }, status: 400,
      });
    }

    // @ts-ignore
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string;
    // @ts-ignore
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[get-order-public][${requestId}] Supabase service config missing`)
      return new Response(JSON.stringify({ success: false, error: 'Supabase service config missing' }), {
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }, status: 500,
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, created_at, total_price, shipping_cost, donation_amount, status, payment_method, shipping_address, guest_email')
      .eq('id', Number(orderId))
      .single();

    if (orderError || !order) {
      console.error(`[get-order-public][${requestId}] Order not found:`, orderId, orderError);
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }, status: 404,
      });
    }

    const { data: items, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('name_at_purchase, quantity, price_at_purchase, image_url_at_purchase')
      .eq('order_id', Number(orderId));

    if (itemsError) {
      console.warn(`[get-order-public][${requestId}] order items error`, itemsError);
    }

    return new Response(JSON.stringify({ success: true, order, items: items || [] }), {
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (err) {
    console.error(`[get-order-public][${requestId}] Error`, err);
    return new Response(JSON.stringify({ success: false, error: 'internal_error' }), {
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }, status: 500,
    });
  }
})
