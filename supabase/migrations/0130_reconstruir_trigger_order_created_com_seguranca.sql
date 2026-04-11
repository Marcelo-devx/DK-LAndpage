-- Primeiro, REMOVER qualquer trigger existente para evitar conflitos
DROP TRIGGER IF EXISTS tr_on_order_created_webhook ON public.orders;

-- Recriar a função do trigger usando net.http_post, que é o caminho suportado nas migrações existentes
CREATE OR REPLACE FUNCTION public.trigger_order_created_webhook()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET SEARCH_PATH TO 'public', 'extensions', 'net'
AS $$
DECLARE
  v_url TEXT := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/trigger-integration';
  v_payload JSONB;
BEGIN
  RAISE NOTICE '[trigger_order_created_webhook] Disparando para pedido %', NEW.id;

  v_payload := jsonb_build_object(
    'event_type', 'order_created',
    'payload', jsonb_build_object('order_id', NEW.id)
  );

  RAISE NOTICE '[trigger_order_created_webhook] Payload: %', v_payload;

  PERFORM net.http_post(
    url := v_url,
    body := v_payload,
    headers := jsonb_build_object('Content-Type', 'application/json')
  );

  RAISE NOTICE '[trigger_order_created_webhook] Webhook disparado com sucesso para pedido %', NEW.id;
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