-- Habilitar extensão de requisições HTTP (caso não esteja)
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Função simplificada para disparar o webhook
CREATE OR REPLACE FUNCTION public.handle_new_order_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  webhook_url text;
  payload jsonb;
  profile_data record;
  user_email text;
BEGIN
  -- 1. Buscar URL configurada
  SELECT target_url INTO webhook_url 
  FROM public.webhook_configs 
  WHERE trigger_event = 'order_created' AND is_active = true 
  LIMIT 1;

  -- 2. Se tiver URL, monta payload e envia SEM VERIFICAR STATUS
  IF webhook_url IS NOT NULL THEN
    
    -- Busca dados básicos do perfil
    SELECT * INTO profile_data FROM public.profiles WHERE id = NEW.user_id;
    
    -- Busca email (seguro pois a função é SECURITY DEFINER)
    SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;

    -- Monta o JSON
    payload := jsonb_build_object(
      'event', 'order_created',
      'order_id', NEW.id,
      'status', NEW.status,
      'total_price', NEW.total_price,
      'shipping_cost', NEW.shipping_cost,
      'payment_method', NEW.payment_method,
      'created_at', NEW.created_at,
      'customer', jsonb_build_object(
        'id', NEW.user_id,
        'first_name', profile_data.first_name,
        'last_name', profile_data.last_name,
        'full_name', (COALESCE(profile_data.first_name, '') || ' ' || COALESCE(profile_data.last_name, '')),
        'phone', profile_data.phone,
        'email', user_email,
        'cpf', profile_data.cpf_cnpj
      ),
      'delivery_address', NEW.shipping_address
    );

    -- Envio assíncrono via pg_net (não trava o site)
    PERFORM net.http_post(
        url := webhook_url,
        body := payload,
        headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Em caso de erro no webhook, não bloqueia a venda!
  RETURN NEW;
END;
$$;

-- Remove triggers antigos que possam estar conflitando
DROP TRIGGER IF EXISTS tr_order_created_webhook ON public.orders;
DROP TRIGGER IF EXISTS on_order_created_net ON public.orders;

-- Cria o novo gatilho limpo (AFTER INSERT)
CREATE TRIGGER tr_order_created_webhook
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_order_webhook();