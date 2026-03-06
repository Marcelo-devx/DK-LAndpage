-- Verificar se as colunas de convidado existem
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('guest_email', 'guest_phone', 'guest_cpf_cnpj');