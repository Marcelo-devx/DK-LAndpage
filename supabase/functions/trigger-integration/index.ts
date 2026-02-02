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

    console.log(`[trigger-integration] Iniciando disparo para evento: ${event_type}`);

    // 1. Buscar a URL do webhook configurada no banco
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

    // 2. Enriquecer o payload
    let enrichedPayload = { ...payload, event: event_type, timestamp: new Date().toISOString() };
    
    // Tenta pegar dados do usuário se disponível
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

    // 3. Disparar para o N8N e aguardar resposta para diagnóstico
    try {
        const response = await fetch(config.target_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(enrichedPayload)
        });

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