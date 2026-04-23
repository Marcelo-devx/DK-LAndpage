// redeploy: 2026-07-13T15:00:00Z
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// Broad CORS — this is a public endpoint called by n8n and the browser
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req: Request) => {
  // CORS preflight — always respond 200 immediately
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS })
  }

  const requestId = crypto.randomUUID()
  console.log(`[get-order-public][${requestId}] ${req.method} ${req.url}`)

  try {
    // Support both POST body and GET query params
    let orderId: string | null = null

    if (req.method === 'GET') {
      const url = new URL(req.url)
      orderId = url.searchParams.get('order_id') || url.searchParams.get('id')
    } else {
      let body: any = {}
      try { body = await req.json() } catch { body = {} }
      orderId = body.order_id || body.id || null
    }

    if (!orderId) {
      return new Response(JSON.stringify({ success: false, error: 'order_id is required' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // @ts-ignore
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') as string
    // @ts-ignore
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[get-order-public][${requestId}] Supabase service config missing`)
      return new Response(JSON.stringify({ success: false, error: 'Supabase service config missing' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, created_at, total_price, shipping_cost, donation_amount, status, payment_method, shipping_address, guest_email')
      .eq('id', Number(orderId))
      .single()

    if (orderError || !order) {
      console.error(`[get-order-public][${requestId}] Order not found:`, orderId, orderError)
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    const { data: items, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('name_at_purchase, quantity, price_at_purchase, image_url_at_purchase')
      .eq('order_id', Number(orderId))

    if (itemsError) {
      console.warn(`[get-order-public][${requestId}] order items error`, itemsError)
    }

    console.log(`[get-order-public][${requestId}] Success — order ${orderId} returned`)

    return new Response(JSON.stringify({ success: true, order, items: items || [] }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err: any) {
    console.error(`[get-order-public][${requestId}] Unhandled error`, err)
    return new Response(JSON.stringify({ success: false, error: 'internal_error' }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
