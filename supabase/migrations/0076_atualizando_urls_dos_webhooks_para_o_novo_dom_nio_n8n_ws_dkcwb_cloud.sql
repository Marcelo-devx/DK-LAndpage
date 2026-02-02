-- Configura Webhooks para produção/teste no novo domínio
INSERT INTO public.webhook_configs (trigger_event, target_url, description, is_active)
VALUES 
  ('order_created', 'https://n8n-ws.dkcwb.cloud/webhook/order-created', 'Disparado ao criar pedido', true),
  ('order_updated', 'https://n8n-ws.dkcwb.cloud/webhook/order-updated', 'Disparado ao atualizar pedido', true),
  ('customer_created', 'https://n8n-ws.dkcwb.cloud/webhook/customer-created', 'Disparado ao criar cliente', true),
  ('chat_message_sent', 'https://n8n-ws.dkcwb.cloud/webhook/chat-message', 'Webhook do ChatBot', true)
ON CONFLICT (trigger_event) 
DO UPDATE SET 
  target_url = EXCLUDED.target_url,
  is_active = true;