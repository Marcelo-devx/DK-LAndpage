-- Adicionar RAISE LOG para debug
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
  v_config_url text;
BEGIN
  -- DEBUG: Log para saber se está sendo chamada
  RAISE LOG '[trigger_order_created_webhook] Iniciando para pedido %', NEW.id;
  
  -- 1. Buscar URL configurada na tabela webhook_configs
  SELECT target_url INTO v_config_url
  FROM public.webhook_configs
  WHERE trigger_event = 'order_created'
    AND is_active = true
  LIMIT 1;
  
  -- Se não houver URL configurada, logar e sair
  IF v_config_url IS NULL OR v_config_url = '' THEN
    RAISE LOG '[trigger_order_created_webhook] URL não configurada';
    INSERT INTO public.integration_logs (event_type, status, details, created_at)
    VALUES ('order_created', 'error', 'URL não configurada em webhook_configs', NOW());
    RETURN NEW;
  END IF;
  
  RAISE LOG '[trigger_order_created_webhook] URL configurada: %', v_config_url;
  
  -- 2. URL da Edge Function (CORRETA agora!)
  v_url := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/trigger-integration';
  
  -- 3. Payload padrão
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
    'Webhook enviado com sucesso - Request ID: ' || v_request_id || ' - URL N8N: ' || v_config_url,
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