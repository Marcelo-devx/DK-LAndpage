-- Atualiza a configuração para 'order_created' (Novo Pedido)
-- IMPORTANTE: Após rodar isso, vá no Table Editor do Supabase e altere a URL abaixo para a sua real do N8N.
UPDATE public.webhook_configs
SET 
    target_url = 'https://SEU-N8N-AQUI.com/webhook/novo-pedido', -- <--- EDITE AQUI NO SUPABASE
    is_active = true
WHERE trigger_event = 'order_created';

-- Atualiza a configuração para 'order_updated' (Mudança de Status)
UPDATE public.webhook_configs
SET 
    target_url = 'https://SEU-N8N-AQUI.com/webhook/atualizacao-pedido', -- <--- EDITE AQUI NO SUPABASE
    is_active = true
WHERE trigger_event = 'order_updated';