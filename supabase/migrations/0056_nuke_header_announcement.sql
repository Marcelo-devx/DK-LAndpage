-- Remove qualquer entrada relacionada ao texto do cabeçalho
DELETE FROM public.app_settings 
WHERE key = 'header_announcement_text';

-- Garante que não sobrou nenhum resquício com valor nulo ou vazio que possa confundir o frontend
DELETE FROM public.app_settings 
WHERE key = 'header_announcement_text';