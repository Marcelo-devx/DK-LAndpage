-- Remover e recriar o trigger
DROP TRIGGER IF EXISTS tr_on_order_created_webhook ON public.orders;

CREATE TRIGGER tr_on_order_created_webhook
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trigger_order_created_webhook();