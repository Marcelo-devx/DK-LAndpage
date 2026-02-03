-- 1. Criar o schema 'extensions' se não existir
CREATE SCHEMA IF NOT EXISTS extensions;

-- 2. Garantir permissões de uso para que o app consiga acessar
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- 3. Mover a extensão 'unaccent' do schema public para extensions
ALTER EXTENSION unaccent SET SCHEMA extensions;

-- 4. Atualizar a função de frete para olhar em 'public' E 'extensions'
-- Isso é crucial, pois antes ela olhava apenas em 'public'
ALTER FUNCTION public.get_shipping_rate(text, text) SET search_path = 'public', 'extensions';

-- 5. Atualizar configuração global sugerida pelo Supabase (Opcional, mas boa prática)
ALTER DATABASE postgres SET search_path TO public, extensions;