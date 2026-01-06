INSERT INTO public.app_settings (key, value)
VALUES ('whatsapp_contact_number', '32991213190')
ON CONFLICT (key)
DO UPDATE SET value = EXCLUDED.value;