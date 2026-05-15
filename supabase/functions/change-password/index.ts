// redeploy: 2026-05-15T15:10:00Z — force deploy change-password edge
// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // CORS preflight — must be handled BEFORE anything else
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    // Verifica o token do usuário para obter o user_id
    const userToken = authHeader.replace('Bearer ', '');
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${userToken}` } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('[change-password] invalid token:', userError);
      return new Response(JSON.stringify({ error: 'Sessão inválida ou expirada.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { password } = await req.json();
    if (!password || password.length < 8) {
      return new Response(JSON.stringify({ error: 'Senha inválida.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[change-password] atualizando senha para user:', user.id);

    // Usa service role para atualizar a senha via Admin API
    const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({ password }),
    });

    if (!updateRes.ok) {
      const errBody = await updateRes.json().catch(() => ({}));
      console.error('[change-password] Admin API error:', updateRes.status, errBody);
      const msg = (errBody as any)?.msg || (errBody as any)?.message || '';
      if (msg.toLowerCase().includes('pwned') || msg.toLowerCase().includes('breach')) {
        return new Response(JSON.stringify({ error: 'Senha encontrada em vazamentos de dados!', code: 'password_pwned' }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Erro ao atualizar senha.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[change-password] senha atualizada, limpando must_change_password...');

    // Usa service role para limpar o flag atomicamente
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user.id);

    if (profileError) {
      console.error('[change-password] failed to clear must_change_password:', profileError);
      // Não falha — a senha já foi atualizada, o flag é secundário
    } else {
      console.log('[change-password] must_change_password=false para user:', user.id);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[change-password] unexpected error:', err?.message || err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
