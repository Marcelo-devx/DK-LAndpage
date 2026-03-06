-- Verificar logs recentes de order_created
SELECT 
  id,
  event_type,
  status,
  response_code,
  created_at,
  details,
  payload
FROM public.integration_logs
WHERE event_type = 'order_created'
ORDER BY created_at DESC
LIMIT 20;