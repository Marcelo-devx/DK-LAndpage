-- Verificar se o trigger está habilitado na tabela pg_trigger
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  tgisinternal as internal
FROM pg_trigger
WHERE tgrelid = 'public.orders'::regclass
  AND tgname = 'tr_on_order_created_webhook';