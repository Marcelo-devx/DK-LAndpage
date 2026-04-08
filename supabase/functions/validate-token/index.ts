// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // ← SEMPRE responde ao preflight OPTIONS primeiro — nunca pode falhar
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { email, code } = await req.json();
    if (!email || !code) {
      return new Response(JSON.stringify({ error: 'email and code required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the most recent unused code for this email
    const { data, error } = await supabase
      .from('email_links')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('token', String(code).trim())
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.error('[validate-token] not found', { email, code, error });
      return new Response(JSON.stringify({ success: false, error: 'Código inválido ou expirado.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const expiresAt = new Date(data.expires_at);
    if (expiresAt.getTime() < Date.now()) {
      console.error('[validate-token] expired', { email, code });
      return new Response(JSON.stringify({ success: false, error: 'Código expirado. Solicite um novo.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as used
    await supabase.from('email_links').update({ used: true }).eq('id', data.id);

    console.log('[validate-token] code validated for', email);
    return new Response(JSON.stringify({ success: true, email: data.email, type: data.type }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[validate-token] unexpected', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
