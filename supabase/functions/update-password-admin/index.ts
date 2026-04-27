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

// Sempre retorna 200 para o SDK não lançar "non-2xx status code"
const ok = (data: object) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const friendlyPasswordError = (errBody: any): { error: string; code: string } => {
  // Supabase retorna: { error_code: "weak_password", msg: "...", weak_password: { reasons: ["pwned"] } }
  const errorCode = errBody?.error_code || '';
  const reasons: string[] = errBody?.weak_password?.reasons || [];
  const rawMsg = (errBody?.msg || errBody?.message || errBody?.error_description || errBody?.error || '').toLowerCase();

  const isPwned = reasons.includes('pwned') || rawMsg.includes('pwned') || rawMsg.includes('haveibeenpwned') || rawMsg.includes('leaked');
  const isWeak = errorCode === 'weak_password' || rawMsg.includes('weak') || rawMsg.includes('easy to guess') || rawMsg.includes('too common');

  if (isPwned) {
    return {
      error: 'Esta senha foi encontrada em vazamentos de dados públicos. Por segurança, escolha uma senha diferente e mais segura.',
      code: 'password_pwned',
    };
  }
  if (isWeak) {
    return {
      error: 'Essa senha é muito fraca ou comum. Escolha uma senha mais forte com letras, números e símbolos.',
      code: 'password_weak',
    };
  }
  if (rawMsg.includes('same as') || rawMsg.includes('different from') || rawMsg.includes('previous')) {
    return {
      error: 'A nova senha não pode ser igual à senha anterior. Crie uma senha diferente.',
      code: 'password_same',
    };
  }
  if (rawMsg.includes('at least') || rawMsg.includes('minimum') || rawMsg.includes('characters')) {
    return {
      error: 'A senha deve ter pelo menos 8 caracteres.',
      code: 'password_too_short',
    };
  }
  return {
    error: 'Falha ao atualizar a senha. Tente novamente.',
    code: 'unknown',
  };
};

// redeploy: 2026-04-27T03:00:00Z — force redeploy was 404
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[update-password-admin] Missing env vars');
      return ok({ success: false, error: 'Servidor não configurado. Contate o suporte.', code: 'server_error' });
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      console.error('[update-password-admin] Missing Authorization token');
      return ok({ success: false, error: 'Sessão inválida. Faça login novamente.', code: 'unauthorized' });
    }

    const body = await req.json().catch(() => ({}));
    const newPassword = body?.newPassword;
    if (!newPassword) {
      return ok({ success: false, error: 'Senha não informada.', code: 'missing_password' });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verificar token do usuário
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.error('[update-password-admin] token verification failed', userErr);
      return ok({ success: false, error: 'Sessão expirada. Faça login novamente.', code: 'invalid_token' });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email || '';
    const userName = userData.user.user_metadata?.full_name || userEmail;

    console.log('[update-password-admin] atualizando senha para userId:', userId);

    // Atualizar senha via REST Admin API
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
      return ok({ success: false, ...friendlyPasswordError(errBody) });
    }

    console.log('[update-password-admin] senha atualizada com sucesso para userId:', userId);

    // Limpar must_change_password
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('[update-password-admin] falha ao limpar must_change_password:', profileUpdateError);
    } else {
      console.log('[update-password-admin] must_change_password=false limpo com sucesso para userId:', userId);
    }

    // Notificar por e-mail (não bloqueia o fluxo)
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
        console.error('[update-password-admin] notify-password-change failed', notifyRes.status);
      } else {
        console.log('[update-password-admin] email de notificação enviado para', userEmail);
      }
    } catch (e) {
      console.error('[update-password-admin] notify error', e);
    }

    return ok({ success: true });

  } catch (err: any) {
    console.error('[update-password-admin] unexpected error', err);
    return ok({ success: false, error: 'Erro inesperado. Tente novamente.', code: 'unexpected' });
  }
})
