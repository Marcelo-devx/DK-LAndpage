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
  
  -- Se a função for chamada por um usuário autenticado, verifique se ele é o dono do pedido.
  -- Se for chamada pelo webhook (serviço), auth.uid() será nulo e esta verificação será ignorada.
  IF auth.uid() IS NOT NULL AND v_order_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Você não tem permissão para finalizar este pedido.';
  END IF;

  IF v_order_status = 'Finalizada' THEN
    -- Já finalizado, evita processamento duplicado
    RETURN;
  END IF;

  IF v_order_status <> 'Aguardando Pagamento' THEN
    RAISE EXCEPTION 'O pedido não está no status correto para finalização de pagamento.';
  END IF;

  -- 2. Atualiza o status do pedido para 'Finalizada'
  UPDATE public.orders
  SET status = 'Finalizada'
  WHERE id = p_order_id;

  -- 3. Deduz o estoque e marca o cupom como usado (se houver)
  
  -- Encontra o cupom usado neste pedido (se houver)
  SELECT id INTO v_user_coupon_id
  FROM public.user_coupons uc
  WHERE uc.user_id = v_order_user_id
    AND uc.is_used = false
    AND EXISTS (
        SELECT 1 FROM public.orders o 
        WHERE o.id = p_order_id 
        AND o.total_price = v_total_price
    )
  LIMIT 1;

  IF v_user_coupon_id IS NOT NULL THEN
    UPDATE public.user_coupons
    SET is_used = true
    WHERE id = v_user_coupon_id;
  END IF;

  -- Itera sobre os itens do pedido para deduzir o estoque
  FOR item_record IN
    SELECT item_id, item_type, quantity FROM public.order_items WHERE order_id = p_order_id
  LOOP
    IF item_record.item_type = 'product' THEN
      UPDATE public.products
      SET stock_quantity = stock_quantity - item_record.quantity
      WHERE id = item_record.item_id;
    ELSIF item_record.item_type = 'promotion' THEN
      UPDATE public.promotions
      SET stock_quantity = stock_quantity - item_record.quantity
      WHERE id = item_record.item_id;
    END IF;
  END LOOP;

  -- 4. Limpa o carrinho do usuário (se existir um carrinho no servidor)
  SELECT id INTO v_cart_id FROM public.carts WHERE user_id = v_order_user_id;
  IF v_cart_id IS NOT NULL THEN
    DELETE FROM public.cart_items WHERE cart_id = v_cart_id;
    DELETE FROM public.carts WHERE id = v_cart_id;
  END IF;

  -- 5. Adiciona pontos ao perfil do usuário com base no valor final pago
  UPDATE public.profiles
  SET points = points + FLOOR(v_total_price)
  WHERE id = v_order_user_id;

END;
$function$