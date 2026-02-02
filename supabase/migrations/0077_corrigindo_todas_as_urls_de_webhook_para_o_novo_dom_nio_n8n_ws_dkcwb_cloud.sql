-- Atualiza ou insere as configurações de webhook corretas
INSERT INTO public.webhook_configs (trigger_event, target_url, is_active, description)
VALUES 
  ('order_created', 'https://n8n-ws.dkcwb.cloud/webhook/novo-pedido', true, 'Disparado quando um novo pedido é criado'),
  ('order_updated', 'https://n8n-ws.dkcwb.cloud/webhook/atualizacao-pedido', true, 'Disparado quando o status do pedido muda'),
  ('customer_created', 'https://n8n-ws.dkcwb.cloud/webhook/novo-cliente', true, 'Disparado no cadastro de usuário'),
  ('support_contact_clicked', 'https://n8n-ws.dkcwb.cloud/webhook/suporte-whatsapp', true, 'Botão flutuante do WhatsApp'),
  ('chat_message_sent', 'https://n8n-ws.dkcwb.cloud/webhook/chat-mensagem', true, 'Mensagens do Chatbot')
ON CONFLICT (trigger_event) 
DO UPDATE SET 
  target_url = EXCLUDED.target_url,
  is_active = true;