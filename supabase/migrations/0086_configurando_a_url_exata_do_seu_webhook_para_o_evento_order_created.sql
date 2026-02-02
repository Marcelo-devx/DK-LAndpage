INSERT INTO public.webhook_configs (trigger_event, target_url, is_active, description)
VALUES (
  'order_created',
  'https://n8n-ws.dkcwb.cloud/webhook/Pedido-criado',
  true,
  'Webhook N8N para Novos Pedidos (JSON Completo)'
)
ON CONFLICT (trigger_event) 
DO UPDATE SET 
  target_url = EXCLUDED.target_url,
  is_active = true;