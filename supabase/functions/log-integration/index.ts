import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { getCorsHeaders, createPreflightResponse } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://jrlozhhvwqfmjtkmvukf.supabase.co'
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// Use service role to bypass RLS and insert logs
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

serve(async (req) => {
  const requestId = crypto.randomUUID()
  const origin = req.headers.get('origin')
  console.log(`[log-integration][${requestId}] ${req.method} ${req.url}`, { origin })

  if (req.method === 'OPTIONS') {
    return createPreflightResponse(origin)
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  let body: any = null
  try {
    body = await req.json()
  } catch {
    console.error(`[log-integration][${requestId}] Invalid JSON body`)
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  console.log(`[log-integration][${requestId}] received body`, JSON.stringify(body).substring(0, 500))

  const { event_type, status, details, payload, response_code } = body

  // Validate required fields
  if (!event_type || !status) {
    console.error(`[log-integration][${requestId}] missing required fields: event_type=${event_type}, status=${status}`)
    return new Response(JSON.stringify({ error: 'event_type and status are required' }), {
      status: 400,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  try {
    const { error: insertError } = await supabase
      .from('integration_logs')
      .insert({
        event_type,
        status,
        details: details || null,
        payload: payload || null,
        response_code: response_code || null,
      })

    if (insertError) {
      console.error(`[log-integration][${requestId}] failed to insert log`, insertError)
      throw new Error(insertError.message)
    }

    console.log(`[log-integration][${requestId}] successfully logged event: ${event_type}`)

    return new Response(JSON.stringify({ success: true, event_type, status }), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error(`[log-integration][${requestId}] error inserting log`, err)
    return new Response(JSON.stringify({ error: err?.message || 'Failed to log integration event' }), {
      status: 500,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }
})
