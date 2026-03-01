-- Tenta remover a tarefa antiga de 15 minutos (com o nome correto), ignorando o erro se não existir.
DO $$
BEGIN
  PERFORM cron.unschedule('cancel-expired-orders-every-5-min');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Job "cancel-expired-orders-every-5-min" não encontrado, ignorando.';
END;
$$;

-- Garante que a nova tarefa não exista antes de criar (em caso de re-execução)
DO $$
BEGIN
  PERFORM cron.unschedule('cancel-expired-orders-60min');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Job "cancel-expired-orders-60min" não encontrado, ignorando.';
END;
$$;

-- Cria a nova tarefa para rodar a cada 30 minutos
SELECT cron.schedule(
  'cancel-expired-orders-60min',
  '*/30 * * * *', -- Executa a cada 30 minutos
  $$ SELECT public.cancel_expired_orders(); $$
);

-- Atualiza a função para cancelar pedidos com mais de 60 minutos
CREATE OR REPLACE FUNCTION public.cancel_expired_orders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.orders
  SET status = 'Cancelado'
  WHERE status = 'Aguardando Pagamento'
    AND created_at < (now() - interval '60 minutes');
END;
$function$