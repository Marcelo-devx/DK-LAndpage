DROP TRIGGER IF EXISTS on_order_created_n8n ON public.orders;
DROP FUNCTION IF EXISTS public.trigger_new_order_webhook();