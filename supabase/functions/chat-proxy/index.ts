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

    const { message, history } = await req.json()

    // 1. Pegar a URL do N8N configurada
    const { data: config } = await supabaseClient
      .from('webhook_configs')
      .select('target_url, is_active')
      .eq('trigger_event', 'chat_message_sent')
      .single();

    if (!config || !config.is_active || !config.target_url) {
      return new Response(JSON.stringify({ 
        reply: "Desculpe, meu sistema de chat está em manutenção no momento. Por favor, use o WhatsApp convencional." 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 2. Identificar usuário (se logado)
    let userData: { type: string; id: string | null; name: string; phone?: string | null } = { type: 'guest', id: null, name: 'Visitante' };
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
            const { data: profile } = await supabaseClient.from('profiles').select('first_name, last_name, phone').eq('id', user.id).single();
            userData = {
                type: 'authenticated',
                id: user.id,
                name: profile ? `${profile.first_name} ${profile.last_name}` : user.email,
                phone: profile?.phone
            };
        }
    }

    // 3. Enviar para o N8N
    // O N8N deve ter um nó "Webhook" (POST) e terminar com um nó "Respond to Webhook" retornando JSON.
    const response = await fetch(config.target_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            message, 
            user: userData,
            history: history || [] 
        })
    });

    if (!response.ok) {
        throw new Error(`Erro no N8N: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Aceita { "text": "..." } ou { "reply": "..." } ou { "message": "..." }
    const replyText = data.text || data.reply || data.message || "Recebido.";

    return new Response(JSON.stringify({ reply: replyText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("[chat-proxy] Error:", error)
    return new Response(JSON.stringify({ reply: "Tive um problema técnico. Pode tentar novamente?" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})