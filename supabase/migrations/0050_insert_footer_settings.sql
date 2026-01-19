INSERT INTO public.app_settings (key, value)
VALUES 
  ('footer_banner_title', 'O Futuro da Sua Experiência'),
  ('footer_banner_subtitle', 'Curadoria exclusiva dos melhores produtos do mundo para quem não aceita o comum.'),
  ('footer_banner_button_text', 'Explorar Tudo'),
  ('contact_email', 'contato@dkcwb.com'),
  ('contact_phone', '(48) 99999-9999'),
  ('contact_hours', 'Segunda a Sábado: 10h - 18h'),
  ('social_facebook', '#'),
  ('social_instagram', '#'),
  ('social_twitter', '#')
ON CONFLICT (key) DO NOTHING;