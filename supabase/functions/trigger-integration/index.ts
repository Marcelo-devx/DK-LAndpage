// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Configuração padrão de CORS (permite chamadas do front)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Inicializa cliente Supabase com permissão de ADMIN (Service Role)
    // Isso é necessário para ler a tabela de configurações sem ser barrado por regras de segurança
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' 
    )

    // 2. RECEBE O GATILHO: O front manda "Quero disparar 'support_contact_clicked'"
    const { event_type, payload } = await req.json()

    console.log(`[trigger-integration] Iniciando disparo para evento: ${event_type}`);

    // 3. IDENTIFICA O DESTINO: Vai no banco descobrir qual a URL para esse evento
    const { data: config, error: dbError } = await supabaseClient
      .from('webhook_configs')
      .select('target_url, is_active')
      .eq('trigger_event', event_type)
      .single();

    if (dbError || !config) {
      console.error(`[trigger-integration] Configuração não encontrada para ${event_type}`, dbError);
      return new Response(JSON.stringify({ error: 'Webhook não configurado' }), { status: 404, headers: corsHeaders });
    }

    if (!config.is_active || !config.target_url) {
      console.log(`[trigger-integration] Webhook inativo ou sem URL: ${event_type}`);
      return new Response(JSON.stringify({ message: 'Skipped (Inactive)' }), { headers: corsHeaders });
    }

    console.log(`[trigger-integration] Alvo: ${config.target_url}`);

    // 4. PREPARA O PACOTE: Adiciona timestamp e tenta pegar dados do usuário logado
    let enrichedPayload = { ...payload, event: event_type, timestamp: new Date().toISOString() };
    
    // Se o usuário mandou o token de auth, buscamos o perfil dele para facilitar sua vida no N8N
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
        try {
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
        } catch (authErr) {
            console.warn("[trigger-integration] Erro ao enriquecer dados do usuário (continuando sem):", authErr);
        }
    }

    // 5. ENVIA A REQUEST (O Disparo Real)
    try {
        const response = await fetch(config.target_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(enrichedPayload)
        });

        // Lê o que o N8N respondeu para ajudar no debug
        const responseText = await response.text();
        console.log(`[trigger-integration] Resposta N8N (${response.status}):`, responseText.substring(0, 200));

        if (!response.ok) {
            throw new Error(`N8N respondeu com erro ${response.status}: ${responseText}`);
        }

        return new Response(JSON.stringify({ success: true, n8n_status: response.status }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (fetchErr: any) {
        console.error(`[trigger-integration] Falha na conexão com N8N:`, fetchErr);
        return new Response(JSON.stringify({ error: `Falha ao contatar N8N: ${fetchErr.message}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 502, // Bad Gateway
        })
    }

  } catch (error: any) {
    console.error("[trigger-integration] Global Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})