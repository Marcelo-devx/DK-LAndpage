-- 1. Garantir que a extensão pg_net está ativa
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Atualizar a função com a chamada correta (net.http_post)
CREATE OR REPLACE FUNCTION public.trigger_order_created_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions', 'net'
AS $$
DECLARE
  v_url text;
  v_payload jsonb;
  v_request_id bigint;
BEGIN
  -- URL INTERNA da Edge Function
  v_url := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/trigger-integration';
  
  v_payload := jsonb_build_object(
    'event_type', 'order_created',
    'payload', jsonb_build_object('order_id', NEW.id)
  );

  -- CORREÇÃO: Usando o schema 'net' e o nome correto da função 'http_post'
  -- A assinatura padrão do pg_net é (url, body, params, headers, ...)
  -- Usamos named parameters para evitar confusão
  
  SELECT net.http_post(
    url := v_url,
    body := v_payload,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM"}'::jsonb
  ) INTO v_request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Evita que falhas no webhook bloqueiem o pedido
  RAISE WARNING 'Falha ao disparar webhook: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 3. Garantir que o gatilho está ativo
DROP TRIGGER IF EXISTS tr_on_order_created_webhook ON public.orders;
CREATE TRIGGER tr_on_order_created_webhook
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_order_created_webhook();