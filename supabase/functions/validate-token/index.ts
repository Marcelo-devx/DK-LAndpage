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

    const { token } = await req.json();
    if (!token) return new Response(JSON.stringify({ error: 'token required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data, error } = await supabase.from('email_links').select('*').eq('token', token).single();
    if (error) {
      console.error('[validate-token] supabase error', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!data) return new Response(JSON.stringify({ error: 'Token not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (data.used) return new Response(JSON.stringify({ error: 'Token already used' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const expiresAt = new Date(data.expires_at);
    if (expiresAt.getTime() < Date.now()) return new Response(JSON.stringify({ error: 'Token expired' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    return new Response(JSON.stringify({ success: true, email: data.email, user_id: data.user_id, type: data.type }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('[validate-token] unexpected', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})
