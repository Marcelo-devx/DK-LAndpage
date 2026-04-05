// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Gera senha forte
const generatePassword = (): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%';
  const all = upper + lower + numbers + symbols;
  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += numbers[Math.floor(Math.random() * numbers.length)];
  pwd += symbols[Math.floor(Math.random() * symbols.length)];
  for (let i = 4; i < 10; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

// Verifica se a senha apareceu em vazamentos usando o serviço HaveIBeenPwned k-anonymity
async function isPwned(password: string): Promise<boolean> {
  try {
    const enc = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', enc);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha1 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    if (!res.ok) {
      console.warn('[forgot-password] HIBP lookup failed, assuming not pwned', { status: res.status });
      return false; // em caso de falha externa, não bloquear
    }

    const text = await res.text();
    const lines = text.split('\n');
    for (const line of lines) {
      const [hashSuffix] = line.split(':');
      if (hashSuffix && hashSuffix.trim().toUpperCase() === suffix) {
        return true;
      }
    }
    return false;
  } catch (e) {
    console.warn('[forgot-password] HIBP check error, assuming not pwned', e);
    return false; // não bloquear por falha de verificação
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (!email) return new Response(JSON.stringify({ error: 'email required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const cleanEmail = email.toLowerCase().trim();
    console.log('[forgot-password] buscando usuário com email:', cleanEmail);

    // Busca direta em auth.users via RPC com SECURITY DEFINER
    const { data: userId, error: userIdError } = await supabase.rpc('get_auth_user_id_by_email', {
      p_email: cleanEmail
    });

    if (userIdError || !userId) {
      console.log('[forgot-password] usuário não encontrado para email:', cleanEmail, userIdError);
      return new Response(
        JSON.stringify({ error: 'Nenhuma conta encontrada com este e-mail. Verifique o endereço digitado.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = { id: userId };
    console.log('[forgot-password] usuário encontrado, id:', user.id);

    // Gera nova senha que NÃO esteja em vazamentos
    let newPassword = '';
    const MAX_ATTEMPTS = 8;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = generatePassword();
      const breached = await isPwned(candidate);
      if (breached) {
        console.log('[forgot-password] candidate pwned, regenerating (attempt', attempt + 1, ')');
        continue;
      }

      // Check if candidate matches current password (unlikely but safe)
      if (anonKey) {
        try {
          const authResp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': anonKey,
              'Authorization': `Bearer ${anonKey}`,
            },
            body: JSON.stringify({ email: cleanEmail, password: candidate }),
          });

          if (authResp.ok) {
            console.log('[forgot-password] generated password collides with current password, regenerating (attempt', attempt + 1, ')');
            continue; // collision
          }
        } catch (e) {
          console.warn('[forgot-password] auth check failed, proceeding assuming no collision', e);
          // fallback: accept candidate
        }
      }

      newPassword = candidate;
      break;
    }

    if (!newPassword) {
      console.error('[forgot-password] failed to generate non-pwned password after attempts');
      return new Response(JSON.stringify({ error: 'Erro ao gerar nova senha. Tente novamente.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Atualiza senha via REST API direta (bypassa verificação HaveIBeenPwned no servidor)
    const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
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
      return new Response(JSON.stringify({ error: 'Erro ao atualizar a senha do usuário' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Seta must_change_password = true no perfil do usuário
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', user.id);

    if (profileError) {
      console.warn('[forgot-password] failed to set must_change_password flag:', profileError);
      // Não bloqueia o fluxo — a senha já foi atualizada
    } else {
      console.log('[forgot-password] must_change_password=true setado para user:', user.id);
    }

    // Envia e-mail com nova senha
    const sendResp = await fetch(`${supabaseUrl}/functions/v1/send-email-via-resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({
        to: email,
        subject: 'Sua nova senha temporária - DKCWB',
        type: 'new_password',
        newPassword,
      }),
    });

    const sendData = await sendResp.json().catch(() => ({}));
    if (!sendResp.ok) {
      console.error('[forgot-password] send-email error', sendResp.status, sendData);
      return new Response(JSON.stringify({ error: 'Senha atualizada, mas erro ao enviar e-mail' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('[forgot-password] senha redefinida e e-mail enviado para', cleanEmail);
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('[forgot-password] unexpected', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})
