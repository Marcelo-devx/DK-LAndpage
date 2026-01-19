-- Limpa a chave específica
DELETE FROM public.app_settings WHERE key = 'header_announcement_text';

-- Insere um valor vazio explícito para garantir que o front-end receba string vazia se tentar buscar
INSERT INTO public.app_settings (key, value) VALUES ('header_announcement_text', '');