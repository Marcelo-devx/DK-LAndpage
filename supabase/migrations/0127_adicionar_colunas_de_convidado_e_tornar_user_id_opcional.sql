-- Adicionar colunas para dados de convidado na tabela orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS guest_email text,
ADD COLUMN IF NOT EXISTS guest_phone text,
ADD COLUMN IF NOT EXISTS guest_cpf_cnpj text;

-- Tornar user_id opcional para pedidos de convidado
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;