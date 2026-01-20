DO $$
DECLARE
    target_uid UUID;
BEGIN
    -- Busca o ID do usuário pelo email
    SELECT id INTO target_uid FROM auth.users WHERE email = 'balanarownage@gmail.com';
    
    IF target_uid IS NOT NULL THEN
        -- Atualiza o saldo de pontos
        UPDATE public.profiles
        SET points = 5000
        WHERE id = target_uid;
    END IF;
END $$;