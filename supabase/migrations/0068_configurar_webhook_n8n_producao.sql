-- Configura o webhook de 'order_created' com a URL real do N8N
UPDATE public.webhook_configs
SET 
    target_url = 'https://capibot-n8nwebhook.zusrjw.easypanel.host/webhook/Pedido-criado',
    is_active = true
WHERE trigger_event = 'order_created';

-- Opcional: Se você tiver fluxos para atualização de pedido, vou deixar pré-configurado
-- apontando para o mesmo domínio, mas com final diferente (você pode editar no painel depois)
UPDATE public.webhook_configs
SET 
    target_url = 'https://capibot-n8nwebhook.zusrjw.easypanel.host/webhook/Pedido-atualizado',
    is_active = true
WHERE trigger_event = 'order_updated';