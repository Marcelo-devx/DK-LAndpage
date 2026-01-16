INSERT INTO public.app_settings (key, value)
VALUES ('whatsapp_contact_number', '5541999999999')
ON CONFLICT (key) DO NOTHING;