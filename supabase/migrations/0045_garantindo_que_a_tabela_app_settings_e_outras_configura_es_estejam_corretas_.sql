-- Garante que a tabela app_settings existe (backup)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adiciona configurações iniciais se não existirem
INSERT INTO public.app_settings (key, value)
VALUES 
  ('whatsapp_contact_number', '5548999999999'),
  ('logo_url', null)
ON CONFLICT (key) DO NOTHING;

-- Garante que RLS está habilitado em todas as tabelas críticas
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Política de leitura pública para configurações do app
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public read settings'
    ) THEN
        CREATE POLICY "Public read settings" ON public.app_settings FOR SELECT USING (true);
    END IF;
END
$$;