-- 1. Inserir configurações padrão para os novos webhooks se não existirem
INSERT INTO public.webhook_configs (trigger_event, target_url, description, is_active)
VALUES 
  ('order_updated', '', 'Disparado quando o status do pedido muda', true),
  ('support_contact_clicked', '', 'Disparado quando clicam no botão de WhatsApp', true),
  ('product_updated', '', 'Disparado quando preço ou estoque de produto muda', true)
ON CONFLICT (trigger_event) DO NOTHING;

-- 2. Função para disparar webhook de produto alterado
CREATE OR REPLACE FUNCTION public.trigger_product_updated_webhook()
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
  -- URL da Edge Function
  v_url := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/trigger-integration';
  
  -- Só dispara se houve mudança relevante (Preço, Estoque, Nome)
  IF (OLD.price IS DISTINCT FROM NEW.price) OR 
     (OLD.stock_quantity IS DISTINCT FROM NEW.stock_quantity) OR
     (OLD.name IS DISTINCT FROM NEW.name) THEN
     
      v_payload := jsonb_build_object(
        'event_type', 'product_updated',
        'payload', jsonb_build_object(
            'product_id', NEW.id,
            'name', NEW.name,
            'old_stock', OLD.stock_quantity,
            'new_stock', NEW.stock_quantity,
            'old_price', OLD.price,
            'new_price', NEW.price,
            'updated_at', NEW.created_at
        )
      );

      v_headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('request.header.authorization', true)
      );

      PERFORM net.http_post(
        url := v_url,
        body := v_payload,
        headers := v_headers
      );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

-- 3. Criar o gatilho na tabela de produtos
DROP TRIGGER IF EXISTS tr_on_product_updated_webhook ON public.products;
CREATE TRIGGER tr_on_product_updated_webhook
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_product_updated_webhook();