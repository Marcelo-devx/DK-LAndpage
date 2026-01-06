-- Atualiza a função que cria um pedido para conceder pontos baseados no valor total
CREATE OR REPLACE FUNCTION public.create_order_from_cart(shipping_cost_input numeric, shipping_address_input jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  cart_id_found bigint;
  total_cart_price numeric;
  new_order_id bigint;
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

  -- Cria o novo pedido
  INSERT INTO public.orders (user_id, total_price, shipping_cost, shipping_address, status)
  VALUES (current_user_id, total_cart_price, shipping_cost_input, shipping_address_input, 'Pendente')
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

  -- Limpa o carrinho
  DELETE FROM public.cart_items WHERE cart_id = cart_id_found;
  DELETE FROM public.carts WHERE id = cart_id_found;

  -- Adiciona pontos ao perfil do usuário com base no valor da compra (1 ponto por R$1)
  UPDATE public.profiles
  SET points = points + FLOOR(total_cart_price)
  WHERE id = current_user_id;

  -- Retorna o ID do novo pedido
  RETURN new_order_id;
END;
$$;