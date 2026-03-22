-- Primeiro, REMOVER qualquer trigger existente para evitar conflitos
DROP TRIGGER IF EXISTS tr_on_order_created_webhook ON public.orders;

-- Verificar se a função existe e recriá-la se necessário
CREATE OR REPLACE FUNCTION public.trigger_order_created_webhook()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER SET SEARCH_PATH TO 'public', 'extensions', 'net'
AS $$
BEGIN
  -- DEBUG: Log para saber se o trigger está sendo chamado
  RAISE NOTICE '[trigger_order_created_webhook] Disparando para pedido %', NEW.id;
  
  -- Só dispara se for INSERT (novo pedido criado)
  IF (TG_OP = 'INSERT') THEN
    DECLARE
      v_url TEXT;
      v_payload JSONB;
      v_event_type TEXT;
    BEGIN
      -- Determina o tipo de evento
      v_event_type := 'order_created';
      
      -- URL da Edge Function que vai disparar o webhook
      v_url := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/trigger-integration';
      
      -- Monta o payload inicial
      v_payload := jsonb_build_object(
        'event_type', v_event_type,
        'payload', jsonb_build_object('order_id', NEW.id)
      );
      
      -- DEBUG: Log do payload
      RAISE NOTICE '[trigger_order_created_webhook] Payload: %', v_payload;
      
      -- Disparo assíncrono via pg_net
      PERFORM net.http_post(
        url := v_url,
        body := v_payload,
        headers := jsonb_build_object('Content-Type', 'application/json')
      );
      
      -- Log de sucesso (será capturado nos logs do Supabase)
      RAISE NOTICE '[trigger_order_created_webhook] Webhook disparado com sucesso para pedido %', NEW.id;
      
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar o trigger NOVAMENTE
CREATE TRIGGER tr_on_order_created_webhook
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_order_created_webhook();

-- Verificar se o trigger foi criado corretamente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'tr_on_order_created_webhook'
  ) THEN
    RAISE NOTICE 'SUCESSO: Trigger tr_on_order_created_webhook foi criado corretamente';
  ELSE
    RAISE EXCEPTION 'ERRO: Trigger não foi criado!';
  END IF;
END $$;