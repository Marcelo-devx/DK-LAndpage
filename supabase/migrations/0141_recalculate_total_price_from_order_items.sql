-- Recalcula total_price para cada pedido com base nos itens do pedido + frete + doação.
-- Safe: só atualiza se o valor atual difere do cálculo esperado.
WITH products_subtotals AS (
  SELECT
    order_id,
    COALESCE(SUM(price_at_purchase * quantity), 0) AS products_total
  FROM public.order_items
  GROUP BY order_id
)
UPDATE public.orders o
SET total_price = COALESCE(ps.products_total, 0) + COALESCE(o.shipping_cost, 0) + COALESCE(o.donation_amount, 0)
FROM products_subtotals ps
WHERE o.id = ps.order_id
  -- evita sobrescrever se já estiver correto
  AND COALESCE(o.total_price, 0) <> (COALESCE(ps.products_total, 0) + COALESCE(o.shipping_cost, 0) + COALESCE(o.donation_amount, 0));

-- Linhas adicionais para pedidos sem order_items (caso existam) — opcional:
UPDATE public.orders
SET total_price = COALESCE(o.total_price, 0) + COALESCE(o.shipping_cost, 0) + COALESCE(o.donation_amount, 0)
WHERE id NOT IN (SELECT order_id FROM public.order_items)
  AND COALESCE(total_price, 0) <> (COALESCE(total_price, 0) + COALESCE(shipping_cost, 0) + COALESCE(donation_amount, 0));

-- Verificação: mostrar os 10 pedidos mais recentes e seus componentes
SELECT
  id,
  COALESCE(
    (SELECT SUM(price_at_purchase * quantity) FROM public.order_items WHERE order_items.order_id = orders.id),
    0
  ) AS produtos,
  COALESCE(shipping_cost, 0) AS frete,
  COALESCE(donation_amount, 0) AS doacao,
  total_price AS total_calculado,
  status,
  created_at
FROM public.orders
ORDER BY created_at DESC
LIMIT 10;