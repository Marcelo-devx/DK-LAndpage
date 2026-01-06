-- 1. Primeiro, vamos somar o valor de todos os pedidos 'Finalizada' deste usuário
-- e atualizar o saldo de pontos dele.
UPDATE public.profiles p
SET points = COALESCE((
    SELECT SUM(FLOOR(total_price))
    FROM public.orders o
    WHERE o.user_id = p.id AND o.status = 'Finalizada'
), 0)
WHERE p.first_name ILIKE '%teste%' OR p.last_name ILIKE '%teste%';

-- 2. Retornar os dados para conferência
SELECT first_name, points FROM public.profiles WHERE first_name ILIKE '%teste%';