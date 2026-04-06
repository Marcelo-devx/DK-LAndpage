-- Atualizar dados de contato do footer na tabela footer_settings
UPDATE public.footer_settings
SET 
  contact_email = 'dondkcwb@protonmail.com',
  contact_phone = '+595 985 981 046',
  updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Se não existir a linha, inserir
INSERT INTO public.footer_settings (id, contact_email, contact_phone, contact_hours, social_facebook, social_instagram, social_twitter, logo_url)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dondkcwb@protonmail.com',
  '+595 985 981 046',
  'Seg - Sex: 10:00 - 18:00 | Sábados: 10:00 - 17:00',
  '#',
  'https://www.instagram.com/dondk_cwb?igsh=MW9mOWZxdGdvaGJtZA%3D%3D',
  '#',
  NULL
)
ON CONFLICT (id) DO NOTHING;
