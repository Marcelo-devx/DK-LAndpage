-- Verificar os pedidos mais recentes
SELECT 
  id,
  user_id,
  status,
  payment_method,
  total_price,
  created_at
FROM public.orders
ORDER BY created_at DESC
LIMIT 10;