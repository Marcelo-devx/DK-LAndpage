-- 1. Adiciona a coluna de controle no perfil
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_credit_card_enabled BOOLEAN DEFAULT FALSE;

-- 2. Ativa manualmente para o seu usuário
UPDATE public.profiles 
SET is_credit_card_enabled = TRUE 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'balanarownage@gmail.com');

-- 3. Atualiza a função de finalização para ativar automaticamente após a primeira compra
CREATE OR REPLACE FUNCTION public.finalize_order_payment(p_order_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_order_user_id uuid;
  v_order_status text;
  v_total_price numeric;
  v_cart_id bigint;
  v_user_coupon_id bigint;
  item_record RECORD;
BEGIN
  -- 1. Verifica o status atual do pedido e o usuário
  SELECT user_id, status, total_price 
  INTO v_order_user_id, v_order_status, v_total_price
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;
  
  IF v_order_status = 'Finalizada' THEN
    RETURN;
  END IF;

  -- 2. Atualiza o status do pedido para 'Finalizada'
  UPDATE public.orders
  SET status = 'Finalizada'
  WHERE id = p_order_id;

  -- 3. Ativa o cartão de crédito para compras futuras
  UPDATE public.profiles
  SET is_credit_card_enabled = TRUE
  WHERE id = v_order_user_id;

  -- 4. Processa estoque e cupons
  SELECT id INTO v_user_coupon_id
  FROM public.user_coupons uc
  WHERE uc.user_id = v_order_user_id
    AND uc.is_used = false
    AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = p_order_id)
  LIMIT 1;

  IF v_user_coupon_id IS NOT NULL THEN
    UPDATE public.user_coupons SET is_used = true WHERE id = v_user_coupon_id;
  END IF;

  FOR item_record IN SELECT item_id, item_type, quantity FROM public.order_items WHERE order_id = p_order_id
  LOOP
    IF item_record.item_type = 'product' THEN
      UPDATE public.products SET stock_quantity = stock_quantity - item_record.quantity WHERE id = item_record.item_id;
    ELSIF item_record.item_type = 'promotion' THEN
      UPDATE public.promotions SET stock_quantity = stock_quantity - item_record.quantity WHERE id = item_record.item_id;
    END IF;
  END LOOP;

  -- 5. Limpa carrinho e adiciona pontos
  SELECT id INTO v_cart_id FROM public.carts WHERE user_id = v_order_user_id;
  IF v_cart_id IS NOT NULL THEN
    DELETE FROM public.cart_items WHERE cart_id = v_cart_id;
    DELETE FROM public.carts WHERE id = v_cart_id;
  END IF;

  UPDATE public.profiles SET points = points + FLOOR(v_total_price) WHERE id = v_order_user_id;
END;
$function$;