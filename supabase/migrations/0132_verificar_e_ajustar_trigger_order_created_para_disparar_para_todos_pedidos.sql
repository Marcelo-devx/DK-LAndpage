-- Verificar se o trigger existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'trigger_order_created_webhook'
    ) THEN
        RAISE NOTICE 'Trigger trigger_order_created_webhook não existe - será criado';
    ELSE
        RAISE NOTICE 'Trigger trigger_order_created_webhook já existe - verificando configuração';
    END IF;
END $$;

-- Recriar a função do trigger para garantir que está funcionando
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
  -- DEBUG: Log para saber se está sendo chamada
  RAISE LOG '[trigger_order_created_webhook] Iniciando para pedido %', NEW.id;
  
  -- IMPORTANTE: Dispara para TODOS os pedidos (PIX e cartão)
  -- O n8n vai processar o pagamento e depois confirmar quando pago
  
  -- 1. Buscar URL configurada na tabela webhook_configs
  SELECT target_url INTO v_url
  FROM public.webhook_configs
  WHERE trigger_event = 'order_created'
    AND is_active = true
  LIMIT 1;
  
  -- Se não houver URL configurada, logar e sair
  IF v_url IS NULL OR v_url = '' THEN
    RAISE LOG '[trigger_order_created_webhook] URL não configurada';
    INSERT INTO public.integration_logs (event_type, status, details, created_at)
    VALUES ('order_created', 'error', 'URL não configurada em webhook_configs', NOW());
    RETURN NEW;
  END IF;
  
  RAISE LOG '[trigger_order_created_webhook] URL configurada: %', v_url;
  
  -- 2. URL da Edge Function
  v_url := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/trigger-integration';
  
  -- 3. Payload padrão para order_created
  v_payload := jsonb_build_object(
    'event_type', 'order_created',
    'payload', jsonb_build_object(
        'order_id', NEW.id,
        'user_id', NEW.user_id,
        'total_price', NEW.total_price,
        'status', NEW.status,
        'payment_method', NEW.payment_method,
        'shipping_address', NEW.shipping_address,
        'created_at', NEW.created_at
    )
  );
  
  -- 4. Headers
  v_headers := jsonb_build_object(
      'Content-Type', 'application/json'
  );
  
  -- 5. Log de início
  INSERT INTO public.integration_logs (event_type, status, payload, details, created_at)
  VALUES ('order_created', 'sending', v_payload, 'Disparando webhook para ' || v_url, NOW());
  
  RAISE LOG '[trigger_order_created_webhook] Inserindo log de início';
  
  -- 6. Disparo Assíncrono via pg_net
  v_request_id := net.http_post(
    url := v_url,
    body := v_payload,
    headers := v_headers
  );
  
  RAISE LOG '[trigger_order_created_webhook] net.http_post executado, request_id: %', v_request_id;
  
  -- 7. Log de sucesso
  INSERT INTO public.integration_logs (event_type, status, details, response_code, created_at)
  VALUES (
    'order_created', 
    'sent', 
    'Webhook enviado com sucesso - Request ID: ' || v_request_id,
    200,
    NOW()
  );
  
  RAISE LOG '[trigger_order_created_webhook] Log de sucesso inserido';
  
  RETURN NEW;
  
EXCEPTION 
  WHEN OTHERS THEN
    -- Log de erro detalhado
    RAISE LOG '[trigger_order_created_webhook] ERRO: %', SQLERRM;
    INSERT INTO public.integration_logs (event_type, status, payload, details, response_code, created_at)
    VALUES (
      'order_created', 
      'error', 
      v_payload, 
      'Erro ao disparar webhook: ' || SQLERRM || ' - State: ' || SQLSTATE,
      500,
      NOW()
    );
    -- Não impedir a criação do pedido mesmo se o webhook falhar
    RETURN NEW;
END;
$$;

-- Drop trigger antigo se existir
DROP TRIGGER IF EXISTS tr_on_order_created_webhook ON public.orders;

-- Criar o trigger novamente
CREATE TRIGGER tr_on_order_created_webhook
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_order_created_webhook();

-- Verificar se o trigger foi criado corretamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_trigger 
        WHERE tgname = 'tr_on_order_created_webhook'
    ) THEN
        RAISE NOTICE 'Trigger tr_on_order_created_webhook criado com sucesso!';
    ELSE
        RAISE EXCEPTION 'Falha ao criar trigger tr_on_order_created_webhook';
    END IF;
END $$;

-- Verificar extensões necessárias
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        RAISE NOTICE 'AVISO: Extensão pg_net não está instalada. Webhooks não funcionarão.';
    ELSE
        RAISE NOTICE 'Extensão pg_net está instalada.';
    END IF;
END $$;