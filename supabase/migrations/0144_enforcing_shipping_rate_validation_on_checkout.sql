CREATE OR REPLACE FUNCTION public.create_pending_order_from_local_cart(
  shipping_cost_input numeric,
  shipping_address_input jsonb,
  cart_items_input jsonb,
  user_coupon_id_input bigint DEFAULT NULL::bigint,
  benefits_input text DEFAULT NULL::text,
  payment_method_input text DEFAULT 'credit_card'::text,
  donation_amount_input numeric DEFAULT 0
)
RETURNS record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
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
  v_item_id bigint;
  v_item_type text;
  v_quantity integer;
  v_variant_id uuid;
  v_price numeric;
  v_pix_price numeric;
  v_final_item_price numeric;
  v_name text;
  v_image_url text;
  v_stock integer;
  v_is_pix boolean;
  v_payment_method_label text;
  v_shipping_rate numeric;
  v_has_free_shipping boolean := false;
  v_neighborhood text;
  v_city text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  UPDATE public.orders
  SET status = 'Cancelado'
  WHERE user_id = current_user_id AND status = 'Aguardando Pagamento';

  v_is_pix := (payment_method_input ILIKE '%pix%');
  v_payment_method_label := CASE WHEN v_is_pix THEN 'Pix' ELSE 'Cartão de Crédito' END;

  v_neighborhood := COALESCE(NULLIF(trim(shipping_address_input->>'neighborhood'), ''), '');
  v_city := COALESCE(NULLIF(trim(shipping_address_input->>'city'), ''), '');

  v_has_free_shipping := COALESCE(benefits_input ILIKE '%frete grátis%', false)
    OR COALESCE(benefits_input ILIKE '%frete gratis%', false);

  IF user_coupon_id_input IS NOT NULL THEN
    SELECT c.discount_value, c.minimum_order_value INTO discount_amount, coupon_min_value
    FROM public.user_coupons uc
    JOIN public.coupons c ON uc.coupon_id = c.id
    WHERE uc.id = user_coupon_id_input
      AND uc.user_id = current_user_id
      AND uc.is_used = false
      AND uc.expires_at > now();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cupom inválido ou expirado.';
    END IF;
  END IF;

  IF NOT v_has_free_shipping THEN
    IF v_neighborhood = '' OR v_city = '' THEN
      RAISE EXCEPTION 'Não conseguimos calcular o frete para esse endereço. Verifique o bairro e a cidade ou entre em contato.';
    END IF;

    v_shipping_rate := public.get_shipping_rate(v_neighborhood, v_city);
    IF v_shipping_rate IS NULL THEN
      RAISE EXCEPTION 'Não conseguimos calcular o frete para esse endereço. Verifique o bairro e a cidade ou entre em contato.';
    END IF;

    IF shipping_cost_input IS NULL OR shipping_cost_input <> v_shipping_rate THEN
      shipping_cost_input := v_shipping_rate;
    END IF;
  ELSE
    shipping_cost_input := 0;
  END IF;

  FOR item_json IN SELECT jsonb_array_elements(cart_items_input)
  LOOP
    v_item_id := (item_json->>'itemId')::bigint;
    v_item_type := item_json->>'itemType';
    v_quantity := (item_json->>'quantity')::integer;
    v_variant_id := (item_json->>'variantId')::uuid;

    IF v_item_type = 'product' THEN
      IF v_variant_id IS NOT NULL THEN
        SELECT price, pix_price, stock_quantity INTO v_price, v_pix_price, v_stock FROM public.product_variants WHERE id = v_variant_id;
      ELSE
        SELECT price, pix_price, stock_quantity INTO v_price, v_pix_price, v_stock FROM public.products WHERE id = v_item_id;
      END IF;
    ELSIF v_item_type = 'promotion' THEN
      SELECT price, pix_price, stock_quantity INTO v_price, v_pix_price, v_stock FROM public.promotions WHERE id = v_item_id;
    END IF;

    IF v_stock < v_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para um ou mais itens. Recarregue a página.';
    END IF;

    v_final_item_price := CASE WHEN v_is_pix AND v_pix_price > 0 THEN v_pix_price ELSE v_price END;
    total_cart_price := total_cart_price + (COALESCE(v_final_item_price, 0) * v_quantity);
  END LOOP;

  IF user_coupon_id_input IS NOT NULL THEN
    IF total_cart_price < coupon_min_value THEN
      RAISE EXCEPTION 'Valor mínimo do cupom não atingido.';
    END IF;
  END IF;

  final_price := GREATEST(0, total_cart_price - discount_amount) + COALESCE(shipping_cost_input, 0) + donation_amount_input;

  INSERT INTO public.orders (
      user_id,
      total_price,
      shipping_cost,
      shipping_address,
      status,
      coupon_discount,
      benefits_used,
      payment_method,
      donation_amount
  )
  VALUES (
      current_user_id,
      final_price,
      shipping_cost_input,
      shipping_address_input,
      'Aguardando Pagamento',
      discount_amount,
      benefits_input,
      v_payment_method_label,
      donation_amount_input
  )
  RETURNING id INTO new_order_id;

  IF user_coupon_id_input IS NOT NULL THEN
    UPDATE public.user_coupons SET is_used = true, order_id = new_order_id WHERE id = user_coupon_id_input;
  END IF;

  FOR item_json IN SELECT jsonb_array_elements(cart_items_input)
  LOOP
    v_item_id := (item_json->>'itemId')::bigint;
    v_item_type := item_json->>'itemType';
    v_quantity := (item_json->>'quantity')::integer;
    v_variant_id := (item_json->>'variantId')::uuid;

    IF v_item_type = 'product' THEN
      SELECT name, image_url, price, pix_price INTO v_name, v_image_url, v_price, v_pix_price FROM public.products WHERE id = v_item_id;
      IF v_variant_id IS NOT NULL THEN
        DECLARE
          v_f_name text;
        BEGIN
          SELECT pv.price, pv.pix_price, f.name INTO v_price, v_pix_price, v_f_name
          FROM public.product_variants pv
          LEFT JOIN public.flavors f ON pv.flavor_id = f.id
          WHERE pv.id = v_variant_id;
          v_name := v_name || ' - ' || COALESCE(v_f_name, 'Opção');
          UPDATE public.product_variants SET stock_quantity = stock_quantity - v_quantity WHERE id = v_variant_id;
        END;
      ELSE
        UPDATE public.products SET stock_quantity = stock_quantity - v_quantity WHERE id = v_item_id;
      END IF;
    ELSIF v_item_type = 'promotion' THEN
      SELECT name, image_url, price, pix_price INTO v_name, v_image_url, v_price, v_pix_price FROM public.promotions WHERE id = v_item_id;
      UPDATE public.promotions SET stock_quantity = stock_quantity - v_quantity WHERE id = v_item_id;
    END IF;

    v_final_item_price := CASE WHEN v_is_pix AND v_pix_price > 0 THEN v_pix_price ELSE v_price END;

    INSERT INTO public.order_items (order_id, item_id, item_type, quantity, price_at_purchase, name_at_purchase, image_url_at_purchase)
    VALUES (new_order_id, v_item_id, v_item_type, v_quantity, v_final_item_price, v_name, v_image_url);
  END LOOP;

  SELECT new_order_id, final_price INTO result_record;
  RETURN result_record;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_guest_order(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_cpf_cnpj text,
  p_shipping_cost numeric,
  p_shipping_address jsonb,
  p_cart_items jsonb,
  p_user_coupon_id bigint DEFAULT NULL::bigint,
  p_benefits text DEFAULT NULL::text,
  p_payment_method text DEFAULT 'credit_card'::text,
  p_donation_amount numeric DEFAULT 0
)
RETURNS record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  total_cart_price numeric := 0;
  new_order_id bigint;
  discount_amount numeric := 0;
  coupon_min_value numeric;
  final_price numeric;
  result_record record;
  item_json jsonb;
  v_item_id bigint;
  v_item_type text;
  v_quantity integer;
  v_variant_id uuid;
  v_price numeric;
  v_pix_price numeric;
  v_final_item_price numeric;
  v_name text;
  v_image_url text;
  v_stock integer;
  v_is_pix boolean;
  v_payment_method_label text;
  v_shipping_rate numeric;
  v_has_free_shipping boolean := false;
  v_neighborhood text;
  v_city text;
BEGIN
  UPDATE public.orders
  SET status = 'Cancelado'
  WHERE guest_email = p_email AND status = 'Aguardando Pagamento';

  v_is_pix := (p_payment_method ILIKE '%pix%');
  v_payment_method_label := CASE WHEN v_is_pix THEN 'Pix' ELSE 'Cartão de Crédito' END;

  v_neighborhood := COALESCE(NULLIF(trim(p_shipping_address->>'neighborhood'), ''), '');
  v_city := COALESCE(NULLIF(trim(p_shipping_address->>'city'), ''), '');

  v_has_free_shipping := COALESCE(p_benefits ILIKE '%frete grátis%', false)
    OR COALESCE(p_benefits ILIKE '%frete gratis%', false);

  IF p_user_coupon_id IS NOT NULL THEN
    SELECT c.discount_value, c.minimum_order_value INTO discount_amount, coupon_min_value
    FROM public.user_coupons uc
    JOIN public.coupons c ON uc.coupon_id = c.id
    WHERE uc.id = p_user_coupon_id
      AND uc.is_used = false
      AND uc.expires_at > now();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cupom inválido ou expirado.';
    END IF;
  END IF;

  IF NOT v_has_free_shipping THEN
    IF v_neighborhood = '' OR v_city = '' THEN
      RAISE EXCEPTION 'Não conseguimos calcular o frete para esse endereço. Verifique o bairro e a cidade ou entre em contato.';
    END IF;

    v_shipping_rate := public.get_shipping_rate(v_neighborhood, v_city);
    IF v_shipping_rate IS NULL THEN
      RAISE EXCEPTION 'Não conseguimos calcular o frete para esse endereço. Verifique o bairro e a cidade ou entre em contato.';
    END IF;

    IF p_shipping_cost IS NULL OR p_shipping_cost <> v_shipping_rate THEN
      p_shipping_cost := v_shipping_rate;
    END IF;
  ELSE
    p_shipping_cost := 0;
  END IF;

  FOR item_json IN SELECT jsonb_array_elements(p_cart_items)
  LOOP
    v_item_id := (item_json->>'itemId')::bigint;
    v_item_type := item_json->>'itemType';
    v_quantity := (item_json->>'quantity')::integer;
    v_variant_id := (item_json->>'variantId')::uuid;

    IF v_item_type = 'product' THEN
      IF v_variant_id IS NOT NULL THEN
        SELECT price, pix_price, stock_quantity INTO v_price, v_pix_price, v_stock FROM public.product_variants WHERE id = v_variant_id;
      ELSE
        SELECT price, pix_price, stock_quantity INTO v_price, v_pix_price, v_stock FROM public.products WHERE id = v_item_id;
      END IF;
    ELSIF v_item_type = 'promotion' THEN
      SELECT price, pix_price, stock_quantity INTO v_price, v_pix_price, v_stock FROM public.promotions WHERE id = v_item_id;
    END IF;

    IF v_stock < v_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para um ou mais itens. Recarregue a página.';
    END IF;

    v_final_item_price := CASE WHEN v_is_pix AND v_pix_price > 0 THEN v_pix_price ELSE v_price END;
    total_cart_price := total_cart_price + (COALESCE(v_final_item_price, 0) * v_quantity);
  END LOOP;

  IF p_user_coupon_id IS NOT NULL THEN
    IF total_cart_price < coupon_min_value THEN
      RAISE EXCEPTION 'Valor mínimo do cupom não atingido.';
    END IF;
  END IF;

  final_price := GREATEST(0, total_cart_price - discount_amount) + COALESCE(p_shipping_cost, 0) + p_donation_amount;

  INSERT INTO public.orders (
      guest_email,
      guest_phone,
      guest_cpf_cnpj,
      total_price,
      shipping_cost,
      shipping_address,
      status,
      coupon_discount,
      benefits_used,
      payment_method,
      donation_amount
  )
  VALUES (
      p_email,
      p_phone,
      p_cpf_cnpj,
      final_price,
      p_shipping_cost,
      p_shipping_address,
      'Aguardando Pagamento',
      discount_amount,
      p_benefits,
      v_payment_method_label,
      p_donation_amount
  )
  RETURNING id INTO new_order_id;

  IF p_user_coupon_id IS NOT NULL THEN
    UPDATE public.user_coupons SET is_used = true, order_id = new_order_id WHERE id = p_user_coupon_id;
  END IF;

  FOR item_json IN SELECT jsonb_array_elements(p_cart_items)
  LOOP
    v_item_id := (item_json->>'itemId')::bigint;
    v_item_type := item_json->>'itemType';
    v_quantity := (item_json->>'quantity')::integer;
    v_variant_id := (item_json->>'variantId')::uuid;

    IF v_item_type = 'product' THEN
      SELECT name, image_url, price, pix_price INTO v_name, v_image_url, v_price, v_pix_price FROM public.products WHERE id = v_item_id;
      IF v_variant_id IS NOT NULL THEN
        DECLARE
          v_f_name text;
        BEGIN
          SELECT pv.price, pv.pix_price, f.name INTO v_price, v_pix_price, v_f_name
          FROM public.product_variants pv
          LEFT JOIN public.flavors f ON pv.flavor_id = f.id
          WHERE pv.id = v_variant_id;
          v_name := v_name || ' - ' || COALESCE(v_f_name, 'Opção');
          UPDATE public.product_variants SET stock_quantity = stock_quantity - v_quantity WHERE id = v_variant_id;
        END;
      ELSE
        UPDATE public.products SET stock_quantity = stock_quantity - v_quantity WHERE id = v_item_id;
      END IF;
    ELSIF v_item_type = 'promotion' THEN
      SELECT name, image_url, price, pix_price INTO v_name, v_image_url, v_price, v_pix_price FROM public.promotions WHERE id = v_item_id;
      UPDATE public.promotions SET stock_quantity = stock_quantity - v_quantity WHERE id = v_item_id;
    END IF;

    v_final_item_price := CASE WHEN v_is_pix AND v_pix_price > 0 THEN v_pix_price ELSE v_price END;

    INSERT INTO public.order_items (order_id, item_id, item_type, quantity, price_at_purchase, name_at_purchase, image_url_at_purchase)
    VALUES (new_order_id, v_item_id, v_item_type, v_quantity, v_final_item_price, v_name, v_image_url);
  END LOOP;

  SELECT new_order_id, final_price INTO result_record;
  RETURN result_record;
END;
$function$;