// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // Busca direta em auth.users via RPC com SECURITY DEFINER — 100% confiável
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

    // Check if the user has a complete profile (all required fields must be filled)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, phone, cpf_cnpj, gender, date_of_birth, cep, street, number, neighborhood, city, state')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.log('[forgot-password] perfil não encontrado para usuário:', user.id);
      return new Response(
        JSON.stringify({ error: 'Cadastro incompleto. Finalize seu cadastro antes de redefinir a senha.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isProfileComplete =
      profile.first_name && profile.last_name && profile.phone &&
      profile.cpf_cnpj && profile.gender && profile.date_of_birth &&
      profile.cep && profile.street && profile.number &&
      profile.neighborhood && profile.city && profile.state;

    if (!isProfileComplete) {
      console.log('[forgot-password] perfil incompleto para usuário:', user.id, profile);
      return new Response(
        JSON.stringify({ error: 'Cadastro incompleto. Finalize seu cadastro antes de redefinir a senha.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a password that is *very unlikely* to equal the current one.
    // As an extra precaution, we attempt to detect collisions by trying to sign in with the generated password
    // using the public auth endpoint. If sign-in succeeds, the generated password equals the current one -> regenerate.
    let newPassword = '';
    const MAX_ATTEMPTS = 6;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = generatePassword();

      // If anon key is present, try to authenticate with this candidate to detect collision
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
            // Candidate matches current password -> regenerate
            console.log('[forgot-password] generated password collides with current password, regenerating (attempt', attempt + 1, ')');
            continue;
          }
        } catch (e) {
          console.warn('[forgot-password] auth check failed, proceeding assuming no collision', e);
          // If auth check fails for network reasons, proceed with candidate
          newPassword = candidate;
          break;
        }
      }

      // If no anonKey or authResp not ok, accept candidate
      newPassword = candidate;
      break;
    }

    if (!newPassword) {
      console.error('[forgot-password] failed to generate non-colliding password after attempts');
      return new Response(JSON.stringify({ error: 'Erro ao gerar nova senha. Tente novamente.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Update user's password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (updateError) {
      console.error('[forgot-password] updateUser error', updateError);
      return new Response(JSON.stringify({ error: 'Erro ao atualizar a senha do usuário' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Send email with new password
    const sendResp = await fetch(`${supabaseUrl}/functions/v1/send-email-via-resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({
        to: email,
        subject: 'Sua nova senha - DKCWB',
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