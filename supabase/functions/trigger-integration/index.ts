// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' 
    )

    const { event_type, payload } = await req.json()

    // 1. Buscar a URL do webhook configurada no banco
    const { data: config } = await supabaseClient
      .from('webhook_configs')
      .select('target_url, is_active')
      .eq('trigger_event', event_type)
      .single();

    if (!config || !config.is_active || !config.target_url) {
      console.log(`[trigger-integration] Webhook para ${event_type} não configurado ou inativo.`);
      return new Response(JSON.stringify({ message: 'Skipped' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 2. Enriquecer o payload com dados do usuário se estiver logado
    let enrichedPayload = { ...payload, timestamp: new Date().toISOString() };
    
    // Tenta pegar o user do header de autorização (se enviado)
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
        const userClient = createClient(
            // @ts-ignore
            Deno.env.get('SUPABASE_URL') ?? '',
            // @ts-ignore
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user } } = await userClient.auth.getUser();
        
        if (user) {
            const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
            enrichedPayload.user = {
                id: user.id,
                email: user.email,
                name: profile?.first_name ? `${profile.first_name} ${profile.last_name}` : 'Visitante',
                phone: profile?.phone,
                tier: profile?.current_tier_name
            };
        }
    }

    // 3. Disparar para o N8N (Fire and Forget - não esperamos a resposta para não travar o botão)
    fetch(config.target_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enrichedPayload)
    }).catch(err => console.error(`[trigger-integration] Erro ao chamar webhook externo:`, err));

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("[trigger-integration] Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})