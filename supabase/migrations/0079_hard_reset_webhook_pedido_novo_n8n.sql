-- 1. Remove triggers e funções antigas para evitar duplicidade ou conflito
DROP TRIGGER IF EXISTS "send-new-order" ON public.orders;
DROP FUNCTION IF EXISTS public.trigger_new_order_webhook();

-- 2. Cria a função que faz o disparo HTTP
CREATE OR REPLACE FUNCTION public.trigger_new_order_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  headers jsonb;
  payload jsonb;
  request_id bigint;
BEGIN
  -- Monta o payload com os dados do pedido
  payload := jsonb_build_object(
    'order_id', NEW.id,
    'total_price', NEW.total_price,
    'status', NEW.status,
    'payment_method', NEW.payment_method,
    'created_at', NEW.created_at,
    'user_id', NEW.user_id,
    'origin', 'database_trigger'
  );

  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true) -- Opcional, para segurança
  );

  -- Faz a chamada HTTP POST para o N8N (URL NOVA E CORRETA)
  SELECT
    net.http_post(
      url := 'https://n8n-ws.dkcwb.cloud/webhook/novo-pedido',
      headers := headers,
      body := payload
    ) INTO request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro de rede, não bloqueia a criação do pedido, apenas loga (se possível) ou ignora
    RAISE WARNING 'Falha ao disparar webhook de novo pedido: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 3. Reconecta o Trigger na tabela de Pedidos (Apenas no INSERT)
CREATE TRIGGER "send-new-order"
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_new_order_webhook();

-- 4. Confirmação na tabela de configurações para a UI do Admin (Edge Function)
UPDATE public.webhook_configs
SET target_url = 'https://n8n-ws.dkcwb.cloud/webhook/novo-pedido',
    is_active = true
WHERE trigger_event = 'order_created';