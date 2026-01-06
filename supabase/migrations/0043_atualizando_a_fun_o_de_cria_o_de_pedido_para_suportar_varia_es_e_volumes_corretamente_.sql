CREATE OR REPLACE FUNCTION public.create_pending_order_from_local_cart(shipping_cost_input numeric, shipping_address_input jsonb, cart_items_input jsonb, user_coupon_id_input bigint DEFAULT NULL::bigint)
 RETURNS record
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  total_cart_price numeric := 0;
  new_order_id bigint;
  discount_amount numeric := 0;
  coupon_min_value numeric;
  final_price numeric;
  result_record record;
  item_json jsonb; 
  item_price numeric;
  item_name text;
  item_image_url text;
  item_stock integer;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- 1. Calcular o preço total e verificar estoque
  FOR item_json IN SELECT jsonb_array_elements(cart_items_input)
  LOOP
    DECLARE
      v_item_id bigint := (item_json->>'itemId')::bigint;
      v_item_type text := item_json->>'itemType';
      v_quantity integer := (item_json->>'quantity')::integer;
      v_variant_id uuid := (item_json->>'variantId')::uuid;
      v_flavor_name text;
      v_volume_ml integer;
    BEGIN
      IF v_item_type = 'product' THEN
        -- Busca dados básicos do produto
        SELECT name, image_url, price, stock_quantity INTO item_name, item_image_url, item_price, item_stock
        FROM public.products WHERE id = v_item_id;

        IF item_price IS NULL THEN
          RAISE EXCEPTION 'Produto não encontrado.';
        END IF;

        -- Se tiver uma variação, sobrepõe o preço e altera o nome
        IF v_variant_id IS NOT NULL THEN
            SELECT pv.price, pv.stock_quantity, f.name, pv.volume_ml 
            INTO item_price, item_stock, v_flavor_name, v_volume_ml
            FROM public.product_variants pv
            LEFT JOIN public.flavors f ON pv.flavor_id = f.id
            WHERE pv.id = v_variant_id;

            IF item_price IS NULL THEN
                RAISE EXCEPTION 'Variação do produto não encontrada.';
            END IF;

            -- Monta o nome completo: Produto - Sabor - Volume
            IF v_flavor_name IS NOT NULL THEN
                item_name := item_name || ' - ' || v_flavor_name;
            END IF;
            IF v_volume_ml IS NOT NULL THEN
                item_name := item_name || ' (' || v_volume_ml || 'ml)';
            END IF;
        END IF;
        
        IF item_stock < v_quantity THEN
          RAISE EXCEPTION 'Estoque insuficiente para o produto %.', item_name;
        END IF;
        
      ELSIF v_item_type = 'promotion' THEN
        SELECT price, name, image_url, stock_quantity INTO item_price, item_name, item_image_url, item_stock
        FROM public.promotions WHERE id = v_item_id;
        
        IF item_price IS NULL THEN
          RAISE EXCEPTION 'Promoção não encontrada.';
        END IF;
        IF item_stock < v_quantity THEN
          RAISE EXCEPTION 'Estoque insuficiente para a promoção %.', item_name;
        END IF;
      END IF;

      total_cart_price := total_cart_price + (item_price * v_quantity);
    END;
  END LOOP;

  -- 2. Lida com o cupom
  IF user_coupon_id_input IS NOT NULL THEN
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
      RAISE EXCEPTION 'O valor do pedido não atinge o mínimo para usar este cupom.';
    END IF;
  END IF;

  final_price := total_cart_price - discount_amount;
  IF final_price < 0 THEN final_price := 0; END IF;

  -- 3. Cria o novo pedido
  INSERT INTO public.orders (user_id, total_price, shipping_cost, shipping_address, status, coupon_discount)
  VALUES (current_user_id, final_price, shipping_cost_input, shipping_address_input, 'Aguardando Pagamento', discount_amount)
  RETURNING id INTO new_order_id;

  -- 4. Insere os itens
  FOR item_json IN SELECT jsonb_array_elements(cart_items_input)
  LOOP
    DECLARE
      v_item_id bigint := (item_json->>'itemId')::bigint;
      v_item_type text := item_json->>'itemType';
      v_quantity integer := (item_json->>'quantity')::integer;
      v_variant_id uuid := (item_json->>'variantId')::uuid;
      v_flavor_name text;
      v_volume_ml integer;
    BEGIN
      IF v_item_type = 'product' THEN
        SELECT name, image_url, price INTO item_name, item_image_url, item_price
        FROM public.products WHERE id = v_item_id;

        IF v_variant_id IS NOT NULL THEN
            SELECT pv.price, f.name, pv.volume_ml 
            INTO item_price, v_flavor_name, v_volume_ml
            FROM public.product_variants pv
            LEFT JOIN public.flavors f ON pv.flavor_id = f.id
            WHERE pv.id = v_variant_id;

            IF v_flavor_name IS NOT NULL THEN item_name := item_name || ' - ' || v_flavor_name; END IF;
            IF v_volume_ml IS NOT NULL THEN item_name := item_name || ' (' || v_volume_ml || 'ml)'; END IF;
        END IF;
      ELSIF v_item_type = 'promotion' THEN
        SELECT price, name, image_url INTO item_price, item_name, item_image_url
        FROM public.promotions WHERE id = v_item_id;
      END IF;

      INSERT INTO public.order_items (order_id, item_id, item_type, quantity, price_at_purchase, name_at_purchase, image_url_at_purchase)
      VALUES (new_order_id, v_item_id, v_item_type, v_quantity, item_price, item_name, item_image_url);
    END;
  END LOOP;

  SELECT new_order_id, final_price INTO result_record;
  RETURN result_record;
END;
$function$;