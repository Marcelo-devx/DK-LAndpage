// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing Authorization token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    const newPassword = body?.newPassword;
    if (!newPassword) {
      return new Response(JSON.stringify({ error: 'newPassword required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create supabase client with service role
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Verify user's token by calling getUser with access token
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.error('[update-password-admin] token verification failed', userErr);
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email || '';
    const userName = userData.user.user_metadata?.full_name || userEmail;

    // Now update user password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password: newPassword });

    if (updateError) {
      console.error('[update-password-admin] updateUser error', updateError);

      // Check if it's a weak/pwned password error
      const isWeakPassword =
        (updateError as any)?.code === 'weak_password' ||
        (updateError as any)?.name === 'AuthWeakPasswordError' ||
        ((updateError as any)?.reasons && (updateError as any).reasons.includes('pwned'));

      if (isWeakPassword) {
        console.log('[update-password-admin] senha rejeitada por ser comprometida (pwned)');
        return new Response(
          JSON.stringify({ error: 'Esta senha foi encontrada em vazamentos de dados e não pode ser usada. Escolha uma senha diferente e mais segura.' }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ error: 'Falha ao atualizar a senha. Tente novamente.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('[update-password-admin] senha atualizada com sucesso para userId:', userId);

    // Notify user via email (non-blocking)
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

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('[update-password-admin] unexpected', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})
