INSERT INTO public.webhook_configs (trigger_event, target_url, description, is_active)
VALUES (
  'chat_message_sent',
  '', 
  'Webhook que recebe a mensagem do usuário e DEVE retornar um JSON { "text": "Resposta do Robô" }',
  false
)
ON CONFLICT (trigger_event) DO NOTHING;