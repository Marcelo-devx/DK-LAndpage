-- Corrigindo 'Function Search Path Mutable' para todas as funções listadas
ALTER FUNCTION public.get_shipping_rate(text, text) SET search_path = 'public';
ALTER FUNCTION public.decrement_stock(text, bigint, integer) SET search_path = 'public';
ALTER FUNCTION public.decrement_variant_stock(uuid, integer) SET search_path = 'public';
ALTER FUNCTION public.get_product_pair_frequency() SET search_path = 'public';
ALTER FUNCTION public.add_item_to_kit_and_lock_stock(bigint, bigint, uuid, integer) SET search_path = 'public';
ALTER FUNCTION public.remove_item_from_kit_and_unlock_stock(bigint) SET search_path = 'public';
ALTER FUNCTION public.update_kit_stock_level(bigint, integer) SET search_path = 'public';
ALTER FUNCTION public.get_customers_at_risk() SET search_path = 'public';
ALTER FUNCTION public.return_stock_on_promotion_delete() SET search_path = 'public';
ALTER FUNCTION public.update_birth_date(date) SET search_path = 'public';
ALTER FUNCTION public.admin_adjust_points(uuid, integer, text) SET search_path = 'public';
ALTER FUNCTION public.get_all_user_coupons_with_usage() SET search_path = 'public';
ALTER FUNCTION public.process_loyalty_on_order_complete() SET search_path = 'public';
ALTER FUNCTION public.recalculate_user_tier(uuid) SET search_path = 'public';
ALTER FUNCTION public.sync_loyalty_history() SET search_path = 'public';
ALTER FUNCTION public.process_annual_birthday_bonus(uuid) SET search_path = 'public';

-- O aviso 'Extension in Public' (unaccent) geralmente pode ser ignorado se você usa muito o schema public,
-- mas configurar o search_path acima já protege o uso dele dentro dessas funções.