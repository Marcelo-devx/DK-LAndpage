-- 1. Garante que a extensão de rede está ativa (necessário para enviar para o N8N)
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. Remove o gatilho antigo para evitar duplicidade ou conflito
DROP TRIGGER IF EXISTS on_order_created_n8n ON public.orders;

-- 3. Cria o gatilho 'Oficial'
CREATE TRIGGER on_order_created_n8n
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_new_order_webhook();