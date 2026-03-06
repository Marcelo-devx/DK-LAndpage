-- Verificar se logs foram gerados para o pedido de teste #180
SELECT 
  id,
  event_type,
  status,
  response_code,
  created_at,
  details
FROM public.integration_logs
WHERE created_at > '2026-03-06 20:23:00'
ORDER BY created_at DESC
LIMIT 5;