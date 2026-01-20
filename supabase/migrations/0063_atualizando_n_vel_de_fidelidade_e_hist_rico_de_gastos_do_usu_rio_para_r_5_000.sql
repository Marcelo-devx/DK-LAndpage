DO $$
DECLARE
    target_uid UUID;
    target_tier_id INT;
    target_tier_name TEXT;
BEGIN
    -- Busca o ID do usuário
    SELECT id INTO target_uid FROM auth.users WHERE email = 'balanarownage@gmail.com';

    IF target_uid IS NOT NULL THEN
        -- 1. Encontrar o nível correto para um gasto de R$ 5.000
        SELECT id, name INTO target_tier_id, target_tier_name
        FROM public.loyalty_tiers
        WHERE min_spend <= 5000
        ORDER BY min_spend DESC
        LIMIT 1;

        -- 2. Atualizar o perfil com o novo nível e gasto simulado
        UPDATE public.profiles
        SET 
            spend_last_6_months = 5000,
            tier_id = target_tier_id,
            current_tier_name = target_tier_name,
            points = 5000, -- Garante o saldo de pontos
            last_tier_update = now()
        WHERE id = target_uid;
    END IF;
END $$;