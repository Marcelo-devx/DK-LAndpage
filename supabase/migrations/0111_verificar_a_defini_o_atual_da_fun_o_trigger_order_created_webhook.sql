-- Verificar a definição atual da função do trigger
SELECT 
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'trigger_order_created_webhook'
  AND pronamespace = 'public'::regnamespace;