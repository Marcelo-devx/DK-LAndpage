import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !supabaseKey) {
      console.error('[generate-token] Missing env vars');
      return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { email, type, expires_in_seconds } = body;
    if (!email || !type) {
      return new Response(JSON.stringify({ error: 'email and type required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Generate 6-digit numeric code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + (expires_in_seconds || 60 * 10) * 1000).toISOString(); // default 10 min

    // Invalidate any previous unused codes for this email+type
    await supabase
      .from('email_links')
      .update({ used: true })
      .eq('email', email)
      .eq('type', type)
      .eq('used', false);

    const { error } = await supabase.from('email_links').insert([{
      email,
      token: code,
      type,
      expires_at: expiresAt,
    }]);

    if (error) {
      console.error('[generate-token] supabase error', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('[generate-token] code generated for', email, type);
    return new Response(JSON.stringify({ success: true, code }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('[generate-token] unexpected', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})
