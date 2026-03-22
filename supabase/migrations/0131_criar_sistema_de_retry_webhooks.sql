-- Tabela para controlar retentativas de webhooks
CREATE TABLE IF NOT EXISTS public.webhook_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  order_id BIGINT,
  payload JSONB,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.webhook_retry_queue ENABLE ROW LEVEL SECURITY;

-- Política: Admin pode tudo
CREATE POLICY "admin_full_access_retry_queue" ON public.webhook_retry_queue
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'adm')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'adm')
);

-- Política: Func (n8n) pode ler e atualizar
CREATE POLICY "worker_access_retry_queue" ON public.webhook_retry_queue
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "worker_update_retry_queue" ON public.webhook_retry_queue
FOR UPDATE TO authenticated
USING (true);

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_webhook_retry_next_attempt ON public.webhook_retry_queue(next_attempt_at, status);
CREATE INDEX IF NOT EXISTS idx_webhook_retry_event_type ON public.webhook_retry_queue(event_type, status);

-- Função para processar a fila de retentativas
CREATE OR REPLACE FUNCTION public.process_webhook_retry_queue()
RETURNS INTEGER
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
  v_retry_count INTEGER := 0;
  v_record RECORD;
BEGIN
  -- Busca itens pendentes que estão prontos para retomar
  FOR v_record IN 
    SELECT id, event_type, order_id, payload, retry_count, max_retries 
    FROM public.webhook_retry_queue
    WHERE status = 'pending' 
      AND next_attempt_at <= NOW()
    ORDER BY next_attempt_at ASC
    LIMIT 10 -- Processa até 10 por vez
  LOOP
    BEGIN
      -- Atualiza para processing
      UPDATE public.webhook_retry_queue
      SET status = 'processing',
          last_attempt_at = NOW(),
          retry_count = retry_count + 1
      WHERE id = v_record.id;
      
      -- Tenta disparar
      BEGIN
        -- URL da Edge Function
        DECLARE
          v_url TEXT := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/trigger-integration';
        BEGIN
          -- Dispara o webhook
          PERFORM net.http_post(
            url := v_url,
            body := jsonb_build_object('event_type', v_record.event_type, 'payload', v_record.payload),
            headers := jsonb_build_object('Content-Type', 'application/json')
          );
          
          -- Se chegou aqui, sucesso! Marca como completed
          UPDATE public.webhook_retry_queue
          SET status = 'completed'
          WHERE id = v_record.id;
          
          v_retry_count := v_retry_count + 1;
          
        EXCEPTION WHEN OTHERS THEN
          -- Falha no disparo
          IF v_record.retry_count >= v_record.max_retries THEN
            -- Excedeu tentativas, marca como falha permanente
            UPDATE public.webhook_retry_queue
            SET status = 'failed',
                error_message = SQLERRM,
                next_attempt_at = NULL
            WHERE id = v_record.id;
          ELSE
            -- Agenda próxima tentativa (exponential backoff: 1min, 5min, 25min)
            UPDATE public.webhook_retry_queue
            SET status = 'pending',
                error_message = SQLERRM,
                next_attempt_at = NOW() + (POWER(5, v_record.retry_count) || ' minutes')::INTERVAL
            WHERE id = v_record.id;
          END IF;
        END;
      END;
    END;
  END LOOP;
  
  RETURN v_retry_count;
END;
$$;

-- Função para adicionar pedido na fila de retry manualmente
CREATE OR REPLACE FUNCTION public.queue_webhook_retry(
  p_event_type TEXT,
  p_order_id BIGINT,
  p_payload JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
  v_retry_id UUID;
BEGIN
  INSERT INTO public.webhook_retry_queue (event_type, order_id, payload)
  VALUES (p_event_type, p_order_id, p_payload)
  RETURNING id INTO v_retry_id;
  
  RETURN v_retry_id;
END;
$$;

-- Função para processar webhooks que falharam nos integration_logs
-- Esta função verifica logs com status 'error' ou 'queued' e cria retentativas
CREATE OR REPLACE FUNCTION public.retry_failed_webhooks_from_logs()
RETURNS INTEGER
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
DECLARE
  v_processed_count INTEGER := 0;
  v_log_record RECORD;
BEGIN
  -- Busca logs de erro ou queued dos últimos 5 minutos
  FOR v_log_record IN
    SELECT id, event_type, payload
    FROM public.integration_logs
    WHERE status IN ('error', 'queued')
      AND created_at >= NOW() - INTERVAL '5 minutes'
      AND NOT EXISTS (
        -- Evita duplicidade: já existe retry pendente para este evento+payload?
        SELECT 1 FROM public.webhook_retry_queue
        WHERE event_type = integration_logs.event_type
          AND payload::TEXT = integration_logs.payload::TEXT
          AND status != 'completed'
          AND status != 'failed'
      )
    ORDER BY created_at DESC
    LIMIT 20
  LOOP
    BEGIN
      -- Cria entrada na fila de retry
      INSERT INTO public.webhook_retry_queue (event_type, order_id, payload, retry_count)
      VALUES (
        v_log_record.event_type,
        (v_log_record.payload->>'order_id')::BIGINT,
        v_log_record.payload
      );
      
      -- Marca o log como em processamento de retry
      UPDATE public.integration_logs
      SET details = details || ' [Na fila de retry]'
      WHERE id = v_log_record.id;
      
      v_processed_count := v_processed_count + 1;
      
    END;
  END LOOP;
  
  RETURN v_processed_count;
END;
$$;