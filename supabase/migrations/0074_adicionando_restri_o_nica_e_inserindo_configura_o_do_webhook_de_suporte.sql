-- 1. Remove duplicatas se houver (mantendo o mais recente), para garantir que podemos criar a restrição única
DELETE FROM public.webhook_configs a USING public.webhook_configs b
WHERE a.id < b.id AND a.trigger_event = b.trigger_event;

-- 2. Adiciona a restrição única na coluna trigger_event se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_configs_trigger_event_key') THEN
        ALTER TABLE public.webhook_configs ADD CONSTRAINT webhook_configs_trigger_event_key UNIQUE (trigger_event);
    END IF;
END $$;

-- 3. Insere o registro agora que a tabela suporta ON CONFLICT
INSERT INTO public.webhook_configs (trigger_event, target_url, description, is_active)
VALUES (
  'support_contact_clicked',
  '',
  'Disparado quando o usuário clica no botão flutuante do WhatsApp',
  false
)
ON CONFLICT (trigger_event) DO NOTHING;