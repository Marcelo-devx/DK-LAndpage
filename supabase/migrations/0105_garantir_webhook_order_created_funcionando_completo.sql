-- 1. Habilitar extensão pg_net (necessária para net.http_post)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Recriar a função de trigger do webhook order_created com logs detalhados
CREATE OR REPLACE FUNCTION public.trigger_order_created_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'net'
AS $$
DECLARE
  v_url text;
  v_payload jsonb;
  v_request_id bigint;
  v_headers jsonb;
BEGIN
  -- Log de início do processamento
  INSERT INTO public.integration_logs (event_type, status, payload, details)
  VALUES ('order_created', 'processing', row_to_json(NEW), 'Iniciando disparo de webhook');
  
  -- Buscar URL configurada para order_created
  SELECT target_url INTO v_url
  FROM public.webhook_configs
  WHERE trigger_event = 'order_created'
    AND is_active = true
  LIMIT 1;
  
  -- Se não houver URL configurada, logar e sair
  IF v_url IS NULL OR v_url = '' THEN
    INSERT INTO public.integration_logs (event_type, status, details)
    VALUES ('order_created', 'error', 'URL não configurada para webhook order_created');
    RETURN NEW;
  END IF;
  
  -- Construir payload
  v_payload := jsonb_build_object(
    'event_type', 'order_created',
    'payload', jsonb_build_object(
        'order_id', NEW.id,
        'user_id', NEW.user_id,
        'total_price', NEW.total_price,
        'status', NEW.status,
        'created_at', NEW.created_at
    )
  );
  
  -- Headers com autorização
  v_headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('request.header.authorization', true)
  );
  
  -- Disparar requisição HTTP assíncrona
  v_request_id := net.http_post(
      url := v_url,
      body := v_payload,
      headers := v_headers
  );
  
  -- Log de sucesso
  INSERT INTO public.integration_logs (event_type, status, payload, details, response_code)
  VALUES (
    'order_created', 
    'success', 
    v_payload, 
    'Webhook disparado com sucesso para ' || v_url || ' - Request ID: ' || v_request_id,
    200
  );
  
  RETURN NEW;
  
EXCEPTION 
  WHEN OTHERS THEN
    -- Log de erro detalhado
    INSERT INTO public.integration_logs (event_type, status, payload, details, response_code)
    VALUES (
      'order_created', 
      'error', 
      row_to_json(NEW), 
      'Erro ao disparar webhook: ' || SQLERRM || ' - Detail: ' || SQLSTATE,
      500
    );
    -- Não impedir a criação do pedido mesmo se o webhook falhar
    RETURN NEW;
END;
$$;

-- 3. Remover triggers existentes para evitar duplicidade
DROP TRIGGER IF EXISTS tr_on_order_created_webhook ON public.orders;
DROP TRIGGER IF EXISTS on_order_created_webhook ON public.orders;
DROP TRIGGER IF EXISTS on_order_created ON public.orders;
DROP TRIGGER IF EXISTS webhook_order_created ON public.orders;

-- 4. Recriar o trigger de AFTER INSERT
CREATE TRIGGER tr_on_order_created_webhook
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_order_created_webhook();

-- 5. Garantir configuração do webhook na tabela
INSERT INTO public.webhook_configs (trigger_event, target_url, description, is_active, created_at)
VALUES (
  'order_created',
  'https://n8n-ws.dkcwb.cloud/webhook/Pedido-criado',
  'Disparado quando um novo pedido é criado no checkout',
  true,
  now()
)
ON CONFLICT (trigger_event) 
DO UPDATE SET 
  target_url = EXCLUDED.target_url,
  is_active = true,
  updated_at = now();