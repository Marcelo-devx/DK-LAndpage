-- 1. Habilitar a extensão pg_net para fazer requisições HTTP de dentro do banco
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. Criar a função que processa os disparos
CREATE OR REPLACE FUNCTION public.process_n8n_webhooks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  payload jsonb;
  config record;
  event_type text;
BEGIN
  -- Definir o tipo de evento com base na operação e tabela
  IF TG_TABLE_NAME = 'orders' THEN
    IF TG_OP = 'INSERT' THEN
      event_type := 'order_created';
    ELSIF TG_OP = 'UPDATE' THEN
      event_type := 'order_updated';
    END IF;
  ELSIF TG_TABLE_NAME = 'profiles' AND TG_OP = 'INSERT' THEN
    event_type := 'customer_created';
  END IF;

  -- Preparar o payload (dados que serão enviados)
  IF TG_OP = 'DELETE' THEN
    payload := row_to_json(OLD)::jsonb;
  ELSE
    payload := row_to_json(NEW)::jsonb;
  END IF;

  -- Adicionar metadados úteis
  payload := payload || jsonb_build_object(
    'event', event_type,
    'timestamp', now(),
    'table', TG_TABLE_NAME
  );

  -- Buscar configurações ativas para este evento e disparar
  FOR config IN
    SELECT target_url 
    FROM public.webhook_configs
    WHERE is_active = true AND trigger_event = event_type
  LOOP
    -- Envia os dados para o N8N (Fire and Forget - não trava o banco)
    PERFORM net.http_post(
      url := config.target_url,
      body := payload,
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END LOOP;

  RETURN NULL;
END;
$$;

-- 3. Criar os gatilhos (Triggers) nas tabelas principais

-- Gatilho para Pedidos (Criação e Atualização)
DROP TRIGGER IF EXISTS trigger_n8n_orders ON public.orders;
CREATE TRIGGER trigger_n8n_orders
  AFTER INSERT OR UPDATE
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.process_n8n_webhooks();

-- Gatilho para Novos Clientes (Criação de Perfil)
DROP TRIGGER IF EXISTS trigger_n8n_profiles ON public.profiles;
CREATE TRIGGER trigger_n8n_profiles
  AFTER INSERT
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.process_n8n_webhooks();

-- 4. Inserir exemplos de configuração (O usuário deve editar a URL no banco depois)
-- Insere apenas se não existir para não duplicar
INSERT INTO public.webhook_configs (trigger_event, target_url, description, is_active)
SELECT 'order_created', 'https://seun8n.com/webhook/novo-pedido', 'Dispara quando um novo pedido é criado', false
WHERE NOT EXISTS (SELECT 1 FROM public.webhook_configs WHERE trigger_event = 'order_created');

INSERT INTO public.webhook_configs (trigger_event, target_url, description, is_active)
SELECT 'order_updated', 'https://seun8n.com/webhook/atualizacao-pedido', 'Dispara quando status do pedido muda', false
WHERE NOT EXISTS (SELECT 1 FROM public.webhook_configs WHERE trigger_event = 'order_updated');

INSERT INTO public.webhook_configs (trigger_event, target_url, description, is_active)
SELECT 'customer_created', 'https://seun8n.com/webhook/novo-cliente', 'Dispara quando um usuário se cadastra', false
WHERE NOT EXISTS (SELECT 1 FROM public.webhook_configs WHERE trigger_event = 'customer_created');