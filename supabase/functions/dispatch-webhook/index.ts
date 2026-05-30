// redeploy: 2026-05-30T02:20:00Z — force full sync
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight — MUST return 200 without reading body
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  // Health check / keep-alive GET
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', function: 'dispatch-webhook', ts: Date.now() }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: any = null
  try {
    const text = await req.text()
    if (!text || text.trim() === '') {
      return new Response(JSON.stringify({ error: 'Body vazio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    body = JSON.parse(text)
  } catch (e) {
    console.error('[dispatch-webhook] ERROR: JSON inválido', e)
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { url, payload, headers: extraHeaders } = body

  if (!url) {
    return new Response(JSON.stringify({ error: 'url é obrigatório' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('[dispatch-webhook] Dispatching to:', url)

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(extraHeaders || {}),
      },
      body: JSON.stringify(payload || {}),
      signal: AbortSignal.timeout(15000),
    })

    const responseText = await resp.text().catch(() => '')
    console.log('[dispatch-webhook] Response:', resp.status, responseText.substring(0, 200))

    return new Response(JSON.stringify({
      success: resp.ok,
      status: resp.status,
      body: responseText.substring(0, 500),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[dispatch-webhook] Fetch error:', err?.message || err)
    return new Response(JSON.stringify({ error: err?.message || 'Erro ao despachar webhook' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
