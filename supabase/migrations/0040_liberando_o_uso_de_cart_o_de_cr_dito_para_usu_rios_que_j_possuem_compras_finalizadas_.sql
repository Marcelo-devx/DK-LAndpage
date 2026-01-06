-- 1. Ativa o cartão para quem já tem pedidos 'Finalizada'
UPDATE public.profiles p
SET is_credit_card_enabled = TRUE
WHERE id IN (
    SELECT DISTINCT user_id 
    FROM public.orders 
    WHERE status = 'Finalizada'
);

-- 2. Verifica o status do usuário teste para confirmação
SELECT first_name, is_credit_card_enabled 
FROM public.profiles 
WHERE first_name ILIKE '%teste%' OR last_name ILIKE '%teste%';