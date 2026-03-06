-- Verificar se a extensão pg_net existe
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'pg_net';