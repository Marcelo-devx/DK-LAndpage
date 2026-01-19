-- Limpa a configuração de texto fixo para que o Timer Automático volte a funcionar
UPDATE public.app_settings
SET value = ''
WHERE key = 'header_announcement_text';