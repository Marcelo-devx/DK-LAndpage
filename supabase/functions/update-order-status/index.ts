// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// Importar CORS utils do shared
import { getCorsHeaders, createPreflightResponse } from '../_shared/cors.ts';

serve(async (req) => {
  // CORS preflight com validação de origem
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return createPreflightResponse(origin);
  }

  try {
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Segurança: Verificar Header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.includes('Bearer')) {
        return new Response(JSON.stringify({ error: 'Acesso negado. Requer autenticação.' }), {
            status: 401,
            headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }
        })
    }

    // Melhoria: Validar o token JWT
    const token = authHeader.replace('Bearer ', '').trim()
    try {
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
        
        if (authError || !user) {
            console.warn('[update-order-status] Token inválido:', authError?.message)
            return new Response(JSON.stringify({ error: 'Token de autenticação inválido.' }), {
                status: 401,
                headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }
            })
        }

        // Verificar se o usuário é admin
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
        
        if (profileError || !profile) {
            console.warn('[update-order-status] Perfil não encontrado para usuário:', user.id)
            return new Response(JSON.stringify({ error: 'Perfil não encontrado.' }), {
                status: 404,
                headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }
            })
        }

        if (profile.role !== 'adm') {
            console.warn('[update-order-status] Usuário não é admin:', user.id, profile.role)
            return new Response(JSON.stringify({ error: 'Acesso negado. Permissões insuficientes.' }), {
                status: 403,
                headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }
            })
        }

        console.log('[update-order-status] Usuário autorizado:', user.email)
    } catch (validationError) {
        console.error('[update-order-status] Erro na validação:', validationError)
        return new Response(JSON.stringify({ error: 'Erro na validação de autenticação.' }), {
            status: 401,
            headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }
        })
    }

    const { order_id, status, delivery_status, tracking_code, delivery_info } = await req.json()

    if (!order_id) {
        return new Response(JSON.stringify({ error: 'order_id é obrigatório.' }), {
            status: 400,
            headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }
        })
    }

    // Criar client com SERVICE_ROLE para atualizações (bypass RLS)
    const supabaseAdmin = createClient(
        // @ts-ignore
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let responseData;
    const s = status ? status.toLowerCase() : '';

    // LÓGICA INTELIGENTE (ATUALIZADA):
    // Aceita Finalizada, Pago, Confirmado, Approved ou Paid para disparar a finalização.
    // Isso garante flexibilidade na integração com N8N/IA.
    if (status === 'Finalizada' || status === 'Pago' || s === 'confirmado' || s === 'approved' || s === 'paid') {
        
        // 1. Atualiza dados de entrega/rastreio se fornecidos (antes de finalizar)
        if (delivery_status || tracking_code || delivery_info) {
            const updates: any = {};
            if (delivery_status) updates.delivery_status = delivery_status;
            if (tracking_code) updates.delivery_info = `Rastreio: ${tracking_code}`;
            else if (delivery_info) updates.delivery_info = delivery_info;
            
            await supabaseAdmin.from('orders').update(updates).eq('id', order_id);
        }

        // 2. Executa a finalização robusta (Pontos + Cartão + Status muda para 'Finalizada')
        // A função RPC 'finalize_order_payment' força o status para 'Finalizada' no banco.
        const { data, error } = await supabaseAdmin.rpc('finalize_order_payment', { 
            p_order_id: order_id 
        });

        if (error) throw error;
        
        // Retorna o pedido atualizado para confirmação
        const { data: updatedOrder } = await supabaseAdmin.from('orders').select('*').eq('id', order_id).single();
        responseData = updatedOrder;

        // Log de sucesso
        await supabaseAdmin.from('integration_logs').insert({
            event_type: 'api_payment_confirmed',
            status: 'success',
            payload: { order_id, input_status: status, method: 'api_manual' },
            details: `Pedido #${order_id} finalizado e pontos concedidos.`
        });

    } else {
        // ATUALIZAÇÃO PADRÃO (Apenas muda os campos de texto, sem lógica de pontos)
        // Usado para atualizações intermediárias como "Em Trânsito"
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
            payload: { order_id, updates },
            details: `Pedido #${order_id} atualizado (campos simples).`
        })
    }

    return new Response(JSON.stringify({ 
        success: true, 
        message: 'Pedido atualizado com sucesso.',
        data: responseData 
    }), {
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("[update-order-status] Erro:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})