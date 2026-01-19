INSERT INTO public.app_settings (key, value)
VALUES 
  ('header_announcement_text', 'FRETE GRÁTIS PARA CURITIBA NAS COMPRAS ACIMA DE R$ 200')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;