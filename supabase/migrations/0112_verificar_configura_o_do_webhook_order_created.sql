-- Verificar configuração do webhook order_created
SELECT 
  trigger_event,
  target_url,
  is_active,
  created_at
FROM public.webhook_configs
WHERE trigger_event = 'order_created';