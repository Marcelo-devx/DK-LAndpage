// redeploy: 2026-04-27T03:00:00Z — force redeploy was 404
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

// Retry com backoff para chamadas fetch internas (ex: send-email-via-resend em cold start)
const fetchWithRetry = async (url: string, options: RequestInit, maxAttempts = 3, baseDelayMs = 1500): Promise<Response> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, options);
      // 404 = função em cold start / ainda não deployada — retenta
      if (res.status === 404 && attempt < maxAttempts) {
        console.warn(`[forgot-password] fetchWithRetry tentativa ${attempt}/${maxAttempts} retornou 404, aguardando ${baseDelayMs * attempt}ms...`);
        await new Promise(r => setTimeout(r, baseDelayMs * attempt));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      console.warn(`[forgot-password] fetchWithRetry tentativa ${attempt}/${maxAttempts} exception:`, err);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, baseDelayMs * attempt));
      }
    }
  }
  throw lastError ?? new Error('fetchWithRetry: todas as tentativas falharam');
};

// Gera senha temporária APENAS com letras e números (sem símbolos especiais)
const generatePassword = (): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const all = upper + lower + numbers;

  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += numbers[Math.floor(Math.random() * numbers.length)];
  for (let i = 3; i < 10; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: 'email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[forgot-password] Missing env vars');
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const cleanEmail = email.toLowerCase().trim();
    console.log('[forgot-password] buscando usuário com email:', cleanEmail);

    const { data: userId, error: userIdError } = await supabase.rpc('get_auth_user_id_by_email', {
      p_email: cleanEmail,
    });

    if (userIdError || !userId) {
      console.log('[forgot-password] usuário não encontrado para email:', cleanEmail, userIdError);
      return new Response(
        JSON.stringify({ error: 'Nenhuma conta encontrada com este e-mail. Verifique o endereço digitado.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[forgot-password] usuário encontrado, id:', userId);

    const newPassword = generatePassword();
    console.log('[forgot-password] nova senha gerada (length):', newPassword.length);

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
      console.error('[forgot-password] REST API updateUser error', updateRes.status, errBody);
      return new Response(JSON.stringify({ error: 'Erro ao atualizar a senha do usuário' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[forgot-password] senha atualizada para user:', userId);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', userId);

    if (profileError) {
      console.warn('[forgot-password] failed to set must_change_password flag:', profileError);
    } else {
      console.log('[forgot-password] must_change_password=true setado para user:', userId);
    }

    // Envia e-mail com retry automático (send-email-via-resend pode estar em cold start)
    console.log('[forgot-password] enviando e-mail via send-email-via-resend (com retry)...');
    const sendResp = await fetchWithRetry(
      `${supabaseUrl}/functions/v1/send-email-via-resend`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
        },
        body: JSON.stringify({
          to: cleanEmail,
          subject: 'Sua nova senha temporária - DKCWB',
          type: 'new_password',
          newPassword,
        }),
      }
    );

    const sendData = await sendResp.json().catch(() => ({}));
    if (!sendResp.ok) {
      console.error('[forgot-password] send-email error', sendResp.status, JSON.stringify(sendData));
      return new Response(JSON.stringify({ error: 'Senha atualizada, mas erro ao enviar e-mail. Tente novamente.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[forgot-password] senha redefinida e e-mail enviado para', cleanEmail);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[forgot-password] unexpected error:', err?.message || err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})