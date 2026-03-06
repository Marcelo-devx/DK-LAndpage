-- Verificar qual função o trigger está usando
SELECT 
  trigger_name,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'orders'
  AND trigger_name = 'tr_on_order_created_webhook';