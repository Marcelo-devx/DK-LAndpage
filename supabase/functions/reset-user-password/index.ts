// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  const { userId, password } = await req.json();

  console.log('[reset-user-password] resetting password for userId:', userId);

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
    },
    body: JSON.stringify({ password }),
  });

  const data = await res.json();
  console.log('[reset-user-password] result:', res.status, JSON.stringify(data));

  return new Response(JSON.stringify({ status: res.status, data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
})
