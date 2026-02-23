-- 1. Ativar extensão pg_net necessária para webhooks internos
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Garantir que a URL do N8N está correta na tabela de configuração
INSERT INTO public.webhook_configs (trigger_event, target_url, is_active, description)
VALUES (
  'order_created',
  'https://n8n-ws.dkcwb.cloud/webhook/pedido-novo',
  true,
  'Dispara fluxo de novo pedido no N8N'
)
ON CONFLICT (trigger_event) 
DO UPDATE SET 
  target_url = 'https://n8n-ws.dkcwb.cloud/webhook/pedido-novo',
  is_active = true;

-- 3. Criar a função que será chamada pelo Trigger do Banco
CREATE OR REPLACE FUNCTION public.trigger_order_created_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_url text;
  v_anon_key text;
  v_payload jsonb;
  request_id bigint;
BEGIN
  -- URL da sua Edge Function (Hardcoded para garantir funcionamento no Supabase)
  -- Nota: Em produção, o ideal é pegar de uma tabela de secrets, mas aqui simplificamos.
  v_url := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/trigger-integration';
  
  -- Pega a anon key (usada para autenticar a chamada à edge function)
  -- Neste caso, como é uma chamada interna, podemos passar uma flag ou usar a service role se necessário,
  -- mas vamos enviar o cabeçalho Authorization padrão.
  -- OBS: Como não temos acesso fácil às env vars dentro do PLPGSQL sem vault, 
  -- vamos confiar que a função trigger-integration aceita chamadas sem auth rigorosa ou
  -- vamos enviar um payload que a identifique.
  
  v_payload := jsonb_build_object(
    'event_type', 'order_created',
    'payload', jsonb_build_object('order_id', NEW.id)
  );

  -- Dispara a requisição HTTP POST assíncrona (não bloqueia o insert)
  -- A chave anon abaixo é pública e segura de estar aqui.
  PERFORM extensions.net_http_post(
    url := v_url,
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM"}'::jsonb,
    body := v_payload
  );

  RETURN NEW;
END;
$$;

-- 4. Recriar o Trigger na tabela orders
DROP TRIGGER IF EXISTS tr_on_order_created_webhook ON public.orders;

CREATE TRIGGER tr_on_order_created_webhook
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_order_created_webhook();