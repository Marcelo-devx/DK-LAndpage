DO $$
DECLARE
    target_email TEXT := 'balanarownage@gmail.com';
    target_uid UUID;
    prata_tier_id INT;
BEGIN
    -- 1. Buscar o ID do usuário pelo email
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;
    
    IF target_uid IS NOT NULL THEN
        -- 2. Buscar o ID do nível 'Prata'
        SELECT id INTO prata_tier_id FROM public.loyalty_tiers WHERE name = 'Prata';

        -- 3. Atualizar o perfil do usuário
        UPDATE public.profiles
        SET 
            spend_last_6_months = 700.00,
            points = 700, -- Adicionando pontos para teste de resgate
            tier_id = prata_tier_id,
            current_tier_name = 'Prata',
            last_tier_update = NOW()
        WHERE id = target_uid;
    END IF;
END $$;