// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // ← SEMPRE responde ao preflight OPTIONS primeiro — nunca pode falhar
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing Authorization token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const newPassword = body?.newPassword;
    if (!newPassword) {
      return new Response(JSON.stringify({ error: 'newPassword required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create supabase client with service role
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify user's token
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.error('[update-password-admin] token verification failed', userErr);
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email || '';
    const userName = userData.user.user_metadata?.full_name || userEmail;

    console.log('[update-password-admin] atualizando senha para userId:', userId);

    // Usar a API REST direta do Supabase Auth com service role key
    const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({ password: newPassword }),
    });

    if (!updateRes.ok) {
      const errBody = await updateRes.json().catch(() => ({}));
      console.error('[update-password-admin] REST API error', updateRes.status, errBody);
      return new Response(
        JSON.stringify({ error: errBody?.message || 'Falha ao atualizar a senha. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[update-password-admin] senha atualizada com sucesso para userId:', userId);

    // Limpar must_change_password via service role (bypassa RLS — garantido)
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('[update-password-admin] falha ao limpar must_change_password:', profileUpdateError);
    } else {
      console.log('[update-password-admin] must_change_password=false limpo com sucesso para userId:', userId);
    }

    // Notificar usuário por e-mail (não bloqueia o fluxo)
    try {
      const notifyRes = await fetch(`${supabaseUrl}/functions/v1/notify-password-change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ email: userEmail, name: userName }),
      });
      if (!notifyRes.ok) {
        const errBody = await notifyRes.text().catch(() => '');
        console.error('[update-password-admin] notify-password-change failed', notifyRes.status, errBody);
      } else {
        console.log('[update-password-admin] email de notificação enviado para', userEmail);
      }
    } catch (e) {
      console.error('[update-password-admin] notify error', e);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[update-password-admin] unexpected', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
