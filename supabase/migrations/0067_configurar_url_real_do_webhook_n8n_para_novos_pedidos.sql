-- Substitua 'SUA_URL_DO_N8N_AQUI' pelo link do seu webhook do N8N
UPDATE public.webhook_configs
SET target_url = 'https://primary-production-796a.up.railway.app/webhook/novo-pedido', -- Exemplo
    is_active = true
WHERE trigger_event = 'order_created';

-- Se quiser configurar também para atualizações de status:
UPDATE public.webhook_configs
SET target_url = 'https://primary-production-796a.up.railway.app/webhook/atualizacao-pedido',
    is_active = true
WHERE trigger_event = 'order_updated';