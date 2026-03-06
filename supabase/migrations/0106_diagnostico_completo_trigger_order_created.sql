-- ============================================
-- DIAGNÓSTICO COMPLETO DO TRIGGER ORDER_CREATED
-- ============================================

-- 1. Verificar se o TRIGGER existe na tabela orders
SELECT 
  'Trigger na tabela orders' as item,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ NOT FOUND' END as status
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'orders'
  AND trigger_name = 'tr_on_order_created_webhook';

-- 2. Verificar se a FUNÇÃO do trigger existe
SELECT 
  'Função trigger_order_created_webhook' as item,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ NOT FOUND' END as status
FROM pg_proc
WHERE proname = 'trigger_order_created_webhook'
  AND pronamespace = 'public'::regnamespace;

-- 3. Verificar se a extensão pg_net está instalada
SELECT 
  'Extensão pg_net' as item,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '✅ INSTALLED' ELSE '❌ NOT INSTALLED' END as status
FROM pg_extension
WHERE extname = 'pg_net';

-- 4. Verificar configuração do webhook
SELECT 
  'Webhook config order_created' as item,
  is_active,
  target_url,
  CASE WHEN is_active = true THEN '✅ ACTIVE' ELSE '❌ INACTIVE' END as status
FROM public.webhook_configs
WHERE trigger_event = 'order_created';

-- 5. Verificar logs recentes (últimos 10)
SELECT 
  id,
  event_type,
  status,
  created_at,
  LEFT(details, 100) as details_preview
FROM public.integration_logs
WHERE event_type = 'order_created'
ORDER BY created_at DESC
LIMIT 10;

-- 6. Listar todos os triggers na tabela orders
SELECT 
  trigger_name,
  event_manipulation,
  event_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'orders'
ORDER BY trigger_name;

-- 7. Verificar função pg_net.http_post
SELECT 
  'Função net.http_post' as item,
  COUNT(*) as count,
  CASE WHEN COUNT(*) > 0 THEN '✅ AVAILABLE' ELSE '❌ NOT AVAILABLE' END as status
FROM pg_proc
WHERE proname = 'http_post'
  AND pronamespace = 'net'::regnamespace;
