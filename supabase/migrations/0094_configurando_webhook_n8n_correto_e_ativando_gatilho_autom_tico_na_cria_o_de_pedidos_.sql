-- 1. Ativação de Extensões
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Atualizar URL do Webhook N8N (Garantia de consistência)
INSERT INTO public.webhook_configs (trigger_event, target_url, is_active, description)
VALUES (
  'order_created',
  'https://n8n-ws.dkcwb.cloud/webhook/pedido-novo',
  true,
  'Webhook Principal N8N'
)
ON CONFLICT (trigger_event) 
DO UPDATE SET 
  target_url = 'https://n8n-ws.dkcwb.cloud/webhook/pedido-novo',
  is_active = true;

-- 3. Atualizar Função de Gatilho (Trigger Function)
CREATE OR REPLACE FUNCTION public.trigger_order_created_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_url text;
  v_payload jsonb;
BEGIN
  -- URL INTERNA da Edge Function (Esta função chama o script que escrevemos acima)
  v_url := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/trigger-integration';
  
  v_payload := jsonb_build_object(
    'event_type', 'order_created',
    'payload', jsonb_build_object('order_id', NEW.id)
  );

  -- Disparo assíncrono via pg_net (Não trava o pedido)
  PERFORM extensions.net_http_post(
    url := v_url,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM"}'::jsonb,
    body := v_payload
  );

  RETURN NEW;
END;
$$;

-- 4. Reconectar o Trigger
DROP TRIGGER IF EXISTS tr_on_order_created_webhook ON public.orders;
CREATE TRIGGER tr_on_order_created_webhook
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_order_created_webhook();