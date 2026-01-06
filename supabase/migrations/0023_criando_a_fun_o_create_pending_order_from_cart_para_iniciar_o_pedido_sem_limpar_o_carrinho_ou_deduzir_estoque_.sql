CREATE OR REPLACE FUNCTION public.create_pending_order_from_cart(shipping_cost_input numeric, shipping_address_input jsonb, user_coupon_id_input bigint DEFAULT NULL::bigint)
 RETURNS record
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  cart_id_found bigint;
  total_cart_price numeric;
  new_order_id bigint;
  discount_amount numeric := 0;
  coupon_min_value numeric;
  final_price numeric;
  result_record record;
BEGIN
  -- Encontra o carrinho do usuário
  SELECT id INTO cart_id_found
  FROM public.carts
  WHERE user_id = current_user_id;

  IF cart_id_found IS NULL THEN
    RAISE EXCEPTION 'Carrinho não encontrado para o usuário.';
  END IF;

  -- Calcula o preço total do carrinho
  SELECT COALESCE(SUM(ci.quantity * COALESCE(p.price, promo.price, 0)), 0)
  INTO total_cart_price
  FROM public.cart_items ci
  LEFT JOIN public.products p ON ci.item_id = p.id AND ci.item_type = 'product'
  LEFT JOIN public.promotions promo ON ci.item_id = promo.id AND ci.item_type = 'promotion'
  WHERE ci.cart_id = cart_id_found;

  -- Lida com o cupom, se fornecido
  IF user_coupon_id_input IS NOT NULL THEN
    -- Verifica o cupom e obtém o valor do desconto
    SELECT c.discount_value, c.minimum_order_value
    INTO discount_amount, coupon_min_value
    FROM public.user_coupons uc
    JOIN public.coupons c ON uc.coupon_id = c.id
    WHERE uc.id = user_coupon_id_input
      AND uc.user_id = current_user_id
      AND uc.is_used = false
      AND uc.expires_at > now();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cupom inválido ou já utilizado.';
    END IF;

    IF total_cart_price < coupon_min_value THEN
      RAISE EXCEPTION 'O valor do pedido não atinge o mínimo para usar este cupom (R$ %).', coupon_min_value;
    END IF;
  END IF;

  -- Calcula o preço final
  final_price := total_cart_price - discount_amount;
  IF final_price < 0 THEN
    final_price := 0;
  END IF;

  -- Cria o novo pedido com o preço final no status 'Aguardando Pagamento'
  INSERT INTO public.orders (user_id, total_price, shipping_cost, shipping_address, status)
  VALUES (current_user_id, final_price, shipping_cost_input, shipping_address_input, 'Aguardando Pagamento')
  RETURNING id INTO new_order_id;

  -- Copia os itens do carrinho para os itens do pedido
  INSERT INTO public.order_items (order_id, item_id, item_type, quantity, price_at_purchase, name_at_purchase, image_url_at_purchase)
  SELECT
    new_order_id,
    ci.item_id,
    ci.item_type,
    ci.quantity,
    COALESCE(p.price, promo.price),
    COALESCE(p.name, promo.name),
    COALESCE(p.image_url, promo.image_url)
  FROM public.cart_items ci
  LEFT JOIN public.products p ON ci.item_id = p.id AND ci.item_type = 'product'
  LEFT JOIN public.promotions promo ON ci.item_id = promo.id AND ci.item_type = 'promotion'
  WHERE ci.cart_id = cart_id_found;

  -- Retorna o ID do novo pedido e o preço final
  SELECT new_order_id, final_price INTO result_record;
  RETURN result_record;
END;
$function$