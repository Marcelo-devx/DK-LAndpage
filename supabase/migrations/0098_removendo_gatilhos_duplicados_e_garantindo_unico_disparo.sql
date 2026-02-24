-- 1. Remover TODAS as variações possíveis de gatilhos antigos para evitar duplicidade
DROP TRIGGER IF EXISTS tr_on_order_created_webhook ON public.orders;
DROP TRIGGER IF EXISTS on_order_created ON public.orders;
DROP TRIGGER IF EXISTS webhook_order_created ON public.orders;
DROP TRIGGER IF EXISTS trigger_new_order_webhook ON public.orders;
DROP TRIGGER IF EXISTS tr_dispatch_order_webhook ON public.orders;

-- Remover também gatilhos que possam estar em UPDATE erroneamente
DROP TRIGGER IF EXISTS tr_on_order_updated_webhook ON public.orders;

-- 2. Atualizar a função do gatilho para garantir URL correta e payload
CREATE OR REPLACE FUNCTION public.trigger_order_created_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'net'
AS $function$
DECLARE
  v_url text;
  v_payload jsonb;
  v_headers jsonb;
BEGIN
  -- URL da Edge Function (usando o nome canônico do arquivo)
  v_url := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/trigger-integration';
  
  -- Payload básico (a Edge Function vai enriquecer com itens e cliente)
  v_payload := jsonb_build_object(
    'event_type', 'order_created',
    'payload', jsonb_build_object(
        'order_id', NEW.id,
        'user_id', NEW.user_id,
        'total_price', NEW.total_price,
        'donation_amount', NEW.donation_amount, -- Garantindo envio explícito da doação
        'status', NEW.status,
        'created_at', NEW.created_at
    )
  );

  -- Headers
  v_headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('request.header.authorization', true)
  );

  -- Disparo Assíncrono via pg_net
  PERFORM net.http_post(
    url := v_url,
    body := v_payload,
    headers := v_headers
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log de erro silencioso para não travar o checkout
  RAISE WARNING 'Falha ao disparar webhook: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- 3. Recriar o gatilho ÚNICO apenas no INSERT
CREATE TRIGGER tr_on_order_created_webhook
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_order_created_webhook();