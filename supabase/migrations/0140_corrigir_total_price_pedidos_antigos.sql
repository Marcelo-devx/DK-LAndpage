-- Atualiza todos os pedidos existentes para incluir frete e doação no total_price
UPDATE public.orders
SET total_price = total_price + COALESCE(shipping_cost, 0) + COALESCE(donation_amount, 0)
WHERE total_price < (total_price + COALESCE(shipping_cost, 0) + COALESCE(donation_amount, 0));

-- Verifica a correção
SELECT 
  id,
  total_price - COALESCE(shipping_cost, 0) - COALESCE(donation_amount, 0) as valor_produtos,
  shipping_cost,
  donation_amount,
  total_price,
  status
FROM public.orders
ORDER BY created_at DESC
LIMIT 10;