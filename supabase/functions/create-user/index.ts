import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'email required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cleanEmail = email.toLowerCase().trim();
    const DEFAULT_PASSWORD = '123456';

    // Use getUserByEmail instead of listUsers() — much faster
    const { data: existingData } = await (supabase.auth.admin as any).getUserByEmail(cleanEmail);

    if (existingData?.user) {
      console.log('[create-user] User already exists:', cleanEmail);
      return new Response(JSON.stringify({ success: true, user_id: existingData.user.id, already_exists: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create user with email already confirmed and default password
    const { data, error } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
    });

    if (error) {
      console.error('[create-user] error creating user', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('[create-user] user created:', data.user?.id);
    return new Response(JSON.stringify({ success: true, user_id: data.user?.id, already_exists: false }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('[create-user] unexpected', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})
