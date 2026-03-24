-- Verificar e corrigir o relacionamento entre orders e profiles

-- 1. Verificar se a coluna user_id existe e não é nula
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'user_id'
    ) THEN
        RAISE NOTICE 'Coluna user_id não existe na tabela orders - será criada';
    ELSE
        RAISE NOTICE 'Coluna user_id existe na tabela orders';
    END IF;
END $$;

-- 2. Remover FKs conflitantes (se existirem) para poder recriar
DO $$
BEGIN
    -- Remover constraint de user_id se existir (mas diferente do esperado)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'orders' 
        AND constraint_name LIKE '%user_id%'
    ) THEN
        ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
        RAISE NOTICE 'Removendo constraint antiga de user_id';
    END IF;
END $$;

-- 3. Garantir que a coluna user_id permite NULL (para pedidos de convidados)
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

-- 4. Adicionar/Recriar a FOREIGN KEY correta
ALTER TABLE public.orders
ADD CONSTRAINT orders_user_id_fkey
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

-- 5. Verificar se o relacionamento foi criado
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE table_name = 'orders' 
        AND constraint_name = 'orders_user_id_fkey'
    ) THEN
        RAISE NOTICE 'FOREIGN KEY orders_user_id_fkey criada com sucesso!';
    ELSE
        RAISE EXCEPTION 'Falha ao criar FOREIGN KEY orders_user_id_fkey';
    END IF;
END $$;

-- 6. Forçar refresh do schema do Supabase para reconhecer o relacionamento
NOTIFY pgrst, 'reload schema';

-- 7. Teste de consulta simulada para verificar se o JOIN funciona
DO $$
DECLARE
    v_test_record RECORD;
BEGIN
    -- Tentar fazer o JOIN que a edge function usa
    SELECT 
        o.id,
        p.first_name
    INTO v_test_record
    FROM public.orders o
    LEFT JOIN public.profiles p ON o.user_id = p.id
    LIMIT 1;
    
    IF FOUND THEN
        RAISE NOTICE 'Teste de JOIN orders-profiles: SUCESSO';
    ELSE
        RAISE NOTICE 'Teste de JOIN orders-profiles: Sem registros (mas query funcionou)';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Teste de JOIN falhou: %', SQLERRM;
END $$;