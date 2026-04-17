// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Vary': 'Origin',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !supabaseKey) {
      console.error('[generate-token] Missing env vars: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { email, type, expires_in_seconds } = body;

    console.log('[generate-token] request received for email:', email, 'type:', type);

    if (!email || !type) {
      return new Response(JSON.stringify({ error: 'email and type required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + (expires_in_seconds || 60 * 10) * 1000).toISOString();

    // Invalida tokens anteriores
    const { error: updateError } = await supabase
      .from('email_links')
      .update({ used: true })
      .eq('email', email.toLowerCase().trim())
      .eq('type', type)
      .eq('used', false);

    if (updateError) {
      console.warn('[generate-token] update (invalidate old) error:', updateError.message);
    }

    // Insere novo token
    const { error } = await supabase.from('email_links').insert([{
      email: email.toLowerCase().trim(),
      token: code,
      type,
      expires_at: expiresAt,
      user_id: null,
    }]);

    if (error) {
      console.error('[generate-token] insert error:', error.message, error.code, error.details);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[generate-token] code generated successfully for', email, type);
    return new Response(JSON.stringify({ success: true, code }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[generate-token] unexpected error:', err?.message || err);
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});