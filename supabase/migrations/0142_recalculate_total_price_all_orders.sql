-- Recalcula total_price para cada pedido com base nos itens do pedido + frete + doação.
-- Atualiza todos os pedidos cujo total_price está incorreto ou é NULL.
BEGIN;

WITH expected AS (
  SELECT
    o.id AS order_id,
    COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0) AS products_total,
    COALESCE(o.shipping_cost, 0) AS shipping_cost,
    COALESCE(o.donation_amount, 0) AS donation_amount,
    (COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0) + COALESCE(o.shipping_cost, 0) + COALESCE(o.donation_amount, 0)) AS expected_total
  FROM public.orders o
  LEFT JOIN public.order_items oi ON oi.order_id = o.id
  GROUP BY o.id, o.shipping_cost, o.donation_amount
)

-- 1) Atualiza orders quando o total atual difere do esperado
UPDATE public.orders o
SET total_price = e.expected_total
FROM expected e
WHERE o.id = e.order_id
  AND COALESCE(o.total_price, 0) <> COALESCE(e.expected_total, 0);

-- 2) Caso ainda existam orders sem total_price definido (NULL), garantir que tenham pelo menos frete+doacao
UPDATE public.orders
SET total_price = COALESCE(shipping_cost, 0) + COALESCE(donation_amount, 0)
WHERE total_price IS NULL;

COMMIT;

-- 3) Verificação: listar pedidos onde ainda existe discrepância (produtos + frete + doação != total_price)
WITH expected AS (
  SELECT
    o.id AS order_id,
    COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0) AS products_total,
    COALESCE(o.shipping_cost, 0) AS shipping_cost,
    COALESCE(o.donation_amount, 0) AS donation_amount,
    (COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0) + COALESCE(o.shipping_cost, 0) + COALESCE(o.donation_amount, 0)) AS expected_total
  FROM public.orders o
  LEFT JOIN public.order_items oi ON oi.order_id = o.id
  GROUP BY o.id, o.shipping_cost, o.donation_amount
)
SELECT
  o.id,
  e.products_total AS produtos,
  o.shipping_cost AS frete,
  o.donation_amount AS doacao,
  o.total_price AS total_atual,
  e.expected_total AS total_esperado,
  o.status,
  o.created_at
FROM expected e
JOIN public.orders o ON o.id = e.order_id
WHERE COALESCE(o.total_price, 0) <> COALESCE(e.expected_total, 0)
ORDER BY o.created_at DESC
LIMIT 50;