-- 1. Garante que a extensão de rede está ativa
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Atualiza a função para incluir a chave 'items' (mesmo que vazia por enquanto) para bater com seu Schema
CREATE OR REPLACE FUNCTION public.trigger_new_order_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  headers jsonb;
  payload jsonb;
  request_id bigint;
  target_url text := 'https://n8n-ws.dkcwb.cloud/webhook/Pedido-criado';
  customer_record RECORD;
BEGIN
  -- Busca dados do cliente
  SELECT 
    p.first_name || ' ' || p.last_name as full_name,
    p.phone,
    u.email,
    p.cpf_cnpj
  INTO customer_record
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE p.id = NEW.user_id;

  -- Monta o payload idêntico ao seu CURL
  payload := jsonb_build_object(
    'event', 'order_created',
    'timestamp', to_jsonb(now()),
    'data', jsonb_build_object(
        'id', NEW.id,
        'total_price', NEW.total_price,
        'status', NEW.status,
        'payment_method', NEW.payment_method,
        'created_at', NEW.created_at,
        'shipping_cost', NEW.shipping_cost,
        'shipping_address', NEW.shipping_address,
        'customer', jsonb_build_object(
            'id', NEW.user_id,
            'full_name', COALESCE(customer_record.full_name, 'Cliente'),
            'email', COALESCE(customer_record.email, 'email@nao.encontrado'),
            'phone', COALESCE(customer_record.phone, ''),
            'cpf', COALESCE(customer_record.cpf_cnpj, '')
        ),
        'items', '[]'::jsonb -- Envia array vazio para manter a estrutura do JSON válida
    )
  );

  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
  );

  -- Log
  INSERT INTO public.integration_logs (event_type, status, payload, details)
  VALUES ('order_created', 'sending', payload, 'Disparando para ' || target_url);

  -- Disparo
  SELECT
    net.http_post(
      url := target_url,
      headers := headers,
      body := payload
    ) INTO request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO public.integration_logs (event_type, status, payload, details)
    VALUES ('order_created', 'error', row_to_json(NEW), SQLERRM);
    RETURN NEW;
END;
$function$;