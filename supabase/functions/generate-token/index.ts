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
    if (!supabaseUrl || !supabaseKey) return new Response('Server not configured', { status: 500, headers: corsHeaders });

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { email, user_id, type, expires_in_seconds } = body;
    if (!email || !type) return new Response(JSON.stringify({ error: 'email and type required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + (expires_in_seconds || 60 * 60 * 24) * 1000).toISOString();

    const { data, error } = await supabase.from('email_links').insert([{ email, user_id, token, type, expires_at: expiresAt }]).select('*');
    if (error) {
      console.error('[generate-token] supabase error', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, token }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('[generate-token] unexpected', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})
