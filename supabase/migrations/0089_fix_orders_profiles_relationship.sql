-- Adiciona chave estrangeira explícita para permitir joins automáticos na API
-- Ex: supabase.from('orders').select('*, profiles(*)')

DO $$
BEGIN
    -- Tenta remover a constraint antiga se existir (para evitar duplicidade ou conflito)
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
    
    -- Adiciona a nova constraint apontando diretamente para public.profiles
    ALTER TABLE public.orders
    ADD CONSTRAINT orders_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id);
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao atualizar constraint: %', SQLERRM;
END $$;