// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// Importar logger sanitizado
import { safeLog, safeErrorLog, sanitizeLogObject } from '../_shared/logger.ts';

// CORS aberto — esta função é chamada pelo n8n (servidor externo) e pelo admin (browser)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, x-webhook-token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Segurança: aceitar autorização via 1) Bearer JWT OR 2) webhook secret header
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    const webhookSecretHeader = req.headers.get('x-webhook-secret') || req.headers.get('x-webhook-token');
    const expectedWebhookSecret = (Deno.env.get('N8N_SECRET_TOKEN') || Deno.env.get('UPDATE_ORDER_WEBHOOK_SECRET') || Deno.env.get('WEBHOOK_SECRET') || '').trim();

    safeLog('[update-order-status] Auth check', {
      hasWebhookHeader: !!webhookSecretHeader,
      hasAuthHeader: !!authHeader,
      hasExpectedSecret: !!expectedWebhookSecret,
      secretMatch: webhookSecretHeader === expectedWebhookSecret,
    });

    let authorizedVia = null as null | 'webhook' | 'jwt';
    let validatedUser: any = null;

    // Extrair token do header Authorization (se existir)
    const bearerToken = authHeader?.includes('Bearer') ? authHeader.replace('Bearer ', '').trim() : null;

    // 1) Verificar se é o secret do n8n — pode vir via x-webhook-secret OU via Authorization: Bearer <secret>
    const isSecretViaHeader = webhookSecretHeader && expectedWebhookSecret && webhookSecretHeader === expectedWebhookSecret;
    const isSecretViaBearer = bearerToken && expectedWebhookSecret && bearerToken === expectedWebhookSecret;

    if (isSecretViaHeader || isSecretViaBearer) {
      authorizedVia = 'webhook';
      safeLog('[update-order-status] Authorized via webhook secret', { method: isSecretViaBearer ? 'bearer' : 'header' });
    } else if (bearerToken) {
      // 2) Tentar validar como JWT de usuário admin
      const token = bearerToken;
      try {
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token as any);
        if (authError || !user) {
          safeErrorLog('[update-order-status] Token inválido:', authError);
          return new Response(JSON.stringify({ error: 'Token de autenticação inválido.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            safeErrorLog('[update-order-status] Perfil não encontrado para usuário:', { userId: user.id, error: profileError });
            return new Response(JSON.stringify({ error: 'Perfil não encontrado.' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (profile.role !== 'adm') {
            safeLog('[update-order-status] Usuário não é admin:', { userId: user.id, role: profile.role });
            return new Response(JSON.stringify({ error: 'Acesso negado. Permissões insuficientes.' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        safeLog('[update-order-status] Usuário autorizado via JWT:', { email: user.email });
        authorizedVia = 'jwt';
        validatedUser = user;
      } catch (validationError) {
        safeErrorLog('[update-order-status] Erro na validação:', validationError);
        return new Response(JSON.stringify({ error: 'Erro na validação de autenticação.' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      safeErrorLog('[update-order-status] Acesso negado — sem credenciais válidas', {
        hasWebhookHeader: !!webhookSecretHeader,
        hasAuthHeader: !!authHeader,
        hasExpectedSecret: !!expectedWebhookSecret,
        hasBearerToken: !!bearerToken,
      });
      return new Response(JSON.stringify({ error: 'Acesso negado. Requer autenticação.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { order_id, status, delivery_status, tracking_code, delivery_info } = await req.json()

    if (!order_id) {
        return new Response(JSON.stringify({ error: 'order_id é obrigatório.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

    safeLog('[update-order-status] Processing', { order_id, status, authorizedVia });

    // Criar client com SERVICE_ROLE para atualizações (bypass RLS)
    const supabaseAdmin = createClient(
        // @ts-ignore
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let responseData;
    const s = status ? status.toLowerCase() : '';

    if (status === 'Finalizada' || status === 'Pago' || s === 'confirmado' || s === 'approved' || s === 'paid') {
        
        if (delivery_status || tracking_code || delivery_info) {
            const updates: any = {};
            if (delivery_status) updates.delivery_status = delivery_status;
            if (tracking_code) updates.delivery_info = `Rastreio: ${tracking_code}`;
            else if (delivery_info) updates.delivery_info = delivery_info;
            
            await supabaseAdmin.from('orders').update(updates).eq('id', order_id);
        }

        const { data, error } = await supabaseAdmin.rpc('finalize_order_payment', { 
            p_order_id: order_id 
        });

        if (error) throw error;
        
        const { data: updatedOrder } = await supabaseAdmin.from('orders').select('*').eq('id', order_id).single();
        responseData = updatedOrder;

        await supabaseAdmin.from('integration_logs').insert({
            event_type: 'api_payment_confirmed',
            status: 'success',
            payload: sanitizeLogObject({ order_id, input_status: status, method: authorizedVia === 'webhook' ? 'webhook' : 'api_manual' }),
            details: `Pedido #${order_id} finalizado e pontos concedidos.`
        });

    } else {
        const updates: any = {}
        if (status) updates.status = status
        if (delivery_status) updates.delivery_status = delivery_status
        
        if (tracking_code) {
            updates.delivery_info = `Rastreio: ${tracking_code}`
        } else if (delivery_info) {
            updates.delivery_info = delivery_info
        }

        const { data, error } = await supabaseAdmin
            .from('orders')
            .update(updates)
            .eq('id', order_id)
            .select()
            .single()

        if (error) throw error;
        responseData = data;

        await supabaseAdmin.from('integration_logs').insert({
            event_type: 'api_update_order',
            status: 'success',
            payload: sanitizeLogObject({ order_id, updates }),
            details: `Pedido #${order_id} atualizado (campos simples).`
        })
    }

    return new Response(JSON.stringify({ 
        success: true, 
        message: 'Pedido atualizado com sucesso.',
        data: responseData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    safeErrorLog("[update-order-status] Erro:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})