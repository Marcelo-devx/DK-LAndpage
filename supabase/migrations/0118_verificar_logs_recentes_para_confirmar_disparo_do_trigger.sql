-- Verificar logs recentes
SELECT 
  id,
  event_type,
  status,
  response_code,
  created_at,
  details
FROM public.integration_logs
WHERE created_at > '2026-03-06 20:25:00'
ORDER BY created_at DESC
LIMIT 10;