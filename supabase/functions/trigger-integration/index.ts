import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('[trigger-integration] OPTIONS preflight received')
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    console.log('[trigger-integration] request received', { method: req.method, pathname: url.pathname })

    // Only allow POST for action
    if (req.method !== 'POST') {
      console.log('[trigger-integration] method not allowed')
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json().catch(() => null)
    console.log('[trigger-integration] body', body)

    // If this is just a simulation/test, return success quickly
    if (body?.simulate) {
      console.log('[trigger-integration] simulate flag detected — returning success')
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Otherwise, you can implement the real dispatch logic here.
    // For now we acknowledge the request and return 200 so clients won't hit CORS preflight issues.
    console.log('[trigger-integration] no simulate flag — acknowledging request')
    return new Response(JSON.stringify({ success: true, received: body ?? null }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('[trigger-integration] error', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
