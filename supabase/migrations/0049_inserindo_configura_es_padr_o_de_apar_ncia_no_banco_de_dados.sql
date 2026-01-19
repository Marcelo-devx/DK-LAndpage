INSERT INTO public.app_settings (key, value)
VALUES 
  ('site_background_color', '#F4EEE3'),
  ('site_primary_color', '#0ea5e9'), -- Sky 500
  ('site_text_color', '#0f172a'), -- Charcoal/Slate 900
  ('show_hero_banner', 'true'),
  ('show_info_section', 'true'),
  ('show_promotions', 'true'),
  ('show_brands', 'true'),
  ('header_announcement_text', 'Frete Grátis para Curitiba nas compras acima de R$ 200')
ON CONFLICT (key) DO NOTHING;