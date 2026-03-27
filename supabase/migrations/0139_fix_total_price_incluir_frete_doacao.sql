-- Corrigir create_pending_order_from_local_cart para incluir frete e doação no total_price
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
  v_is_pix boolean;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- Cancelar pedidos antigos em "Aguardando Pagamento"
  -- O trigger 'return_order_stock' cuidará de devolver o estoque.
  UPDATE public.orders
  SET status = 'Cancelado'
  WHERE user_id = current_user_id AND status = 'Aguardando Pagamento';

  v_is_pix := (payment_method_input ILIKE '%pix%');

  -- 1. Loop: Calcular Subtotal (Baseado no estoque atual)
  FOR item_json IN SELECT jsonb_array_elements(cart_items_input)
  LOOP
    DECLARE
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
    BEGIN
      v_item_id := (item_json->>'itemId')::bigint;
      v_item_type := item_json->>'itemType';
      v_quantity := (item_json->>'quantity')::integer;
      v_variant_id := (item_json->>'variantId')::uuid;

      IF v_item_type = 'product' THEN
        IF v_variant_id IS NOT NULL THEN
          SELECT price, pix_price, stock_quantity, image_url INTO v_price, v_pix_price, v_stock, v_image_url 
          FROM public.product_variants WHERE id = v_variant_id;
        ELSE
          SELECT price, pix_price, stock_quantity, image_url INTO v_price, v_pix_price, v_stock, v_image_url 
          FROM public.products WHERE id = v_item_id;
        END IF;
      ELSIF v_item_type = 'promotion' THEN
        SELECT price, pix_price, stock_quantity, image_url INTO v_price, v_pix_price, v_stock, v_image_url 
        FROM public.promotions WHERE id = v_item_id;
      END IF;

      IF v_stock < v_quantity THEN 
        RAISE EXCEPTION 'Estoque insuficiente para um ou mais itens. Recarregue a página.'; 
      END IF;

      v_final_item_price := CASE WHEN v_is_pix AND v_pix_price > 0 THEN v_pix_price ELSE v_price END;
      total_cart_price := total_cart_price + (COALESCE(v_final_item_price, 0) * v_quantity);
    END;
  END LOOP;

  -- 2. Lidar com o cupom
  IF user_coupon_id_input IS NOT NULL THEN
    SELECT c.discount_value, c.minimum_order_value INTO discount_amount, coupon_min_value
    FROM public.user_coupons uc JOIN public.coupons c ON uc.coupon_id = c.id
    WHERE uc.id = user_coupon_id_input AND uc.user_id = current_user_id AND uc.is_used = false AND uc.expires_at > now();
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Cupom inválido ou expirado.'; END IF;
    IF total_cart_price < coupon_min_value THEN RAISE EXCEPTION 'Valor mínimo do cupom não atingido.'; END IF;
  END IF;

  -- 3. Cálculo Final: (Subtotal - Desconto + Frete + Doação)
  final_price := GREATEST(0, total_cart_price - discount_amount);
  
  -- IMPORTANTE: total_price DEVE incluir frete e doação
  -- O valor final a pagar é: final_price (produtos com desconto) + shipping_cost + donation_amount
  DECLARE
    v_final_total numeric;
  BEGIN
    v_final_total := final_price + shipping_cost_input + donation_amount_input;
  END;

  -- 4. Criar o cabeçalho do pedido
  INSERT INTO public.orders (
    user_id, 
    total_price, -- AGORA INCLUI FRETE E DOAÇÃO
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
    v_final_total, -- TOTAL CORRETO: produtos + frete + doação
    shipping_cost_input, 
    shipping_address_input, 
    'Aguardando Pagamento', 
    discount_amount, 
    benefits_input, 
    CASE WHEN v_is_pix THEN 'Pix' ELSE 'Cartão de Crédito' END, 
    donation_amount_input
  )
  RETURNING id INTO new_order_id;

  -- 5. Vincular cupom se houver
  IF user_coupon_id_input IS NOT NULL THEN
    UPDATE public.user_coupons SET is_used = true, order_id = new_order_id WHERE id = user_coupon_id_input;
  END IF;

  -- 6. Terceiro Loop: Gravar Itens e Deduzir Estoque
  FOR item_json IN SELECT jsonb_array_elements(cart_items_input)
  LOOP
    DECLARE
      v_item_id bigint;
      v_item_type text;
      v_quantity integer;
      v_variant_id uuid;
      v_name text;
      v_image_url text;
      v_price numeric;
      v_pix_price numeric;
      v_final_item_price numeric;
    BEGIN
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
            FROM public.product_variants pv LEFT JOIN public.flavors f ON pv.flavor_id = f.id WHERE pv.id = v_variant_id;
            v_name := v_name || ' - ' || COALESCE(v_f_name, 'Opção');
            UPDATE public.product_variants SET stock_quantity = stock_quantity - v_quantity WHERE id = v_variant_id;
          END;
        ELSE
          UPDATE public.products SET stock_quantity = stock_quantity - v_quantity WHERE id = v_item_id;
        END IF;
      ELSIF v_item_type = 'promotion' THEN
        SELECT price, pix_price, name, image_url INTO v_price, v_pix_price, v_name, v_image_url FROM public.promotions WHERE id = v_item_id;
        UPDATE public.promotions SET stock_quantity = stock_quantity - v_quantity WHERE id = v_item_id;
      END IF;

      v_final_item_price := CASE WHEN v_is_pix AND v_pix_price > 0 THEN v_pix_price ELSE v_price END;

      INSERT INTO public.order_items (order_id, item_id, item_type, quantity, price_at_purchase, name_at_purchase, image_url_at_purchase)
      VALUES (new_order_id, v_item_id, v_item_type, v_quantity, v_final_item_price, v_name, v_image_url);
    END;
  END LOOP;

  SELECT new_order_id, v_final_total INTO result_record;
  RETURN result_record;
END;
$function$;

-- Corrigir create_guest_order para incluir frete e doação no total_price
CREATE OR REPLACE FUNCTION public.create_guest_order(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_cpf_cnpj text,
  p_shipping_cost numeric,
  p_shipping_address jsonb,
  p_cart_items jsonb,
  p_payment_method text,
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
  final_price numeric;
  result_record record;
  item_json jsonb;
  v_is_pix boolean;
BEGIN
  v_is_pix := (p_payment_method ILIKE '%pix%');

  -- 1. Calcular subtotal dos itens
  FOR item_json IN SELECT jsonb_array_elements(p_cart_items)
  LOOP
    DECLARE
      v_item_id bigint := (item_json->>'itemId')::bigint;
      v_item_type text := item_json->>'itemType';
      v_quantity integer := (item_json->>'quantity')::integer;
      v_variant_id uuid := (item_json->>'variantId')::uuid;
      v_price numeric;
      v_pix_price numeric;
      v_final_item_price numeric;
      v_name text;
      v_image_url text;
    BEGIN
      IF v_item_type = 'product' THEN
        SELECT name, image_url, price, pix_price INTO v_name, v_image_url, v_price, v_pix_price 
        FROM public.products WHERE id = v_item_id;
        
        IF v_variant_id IS NOT NULL THEN
          SELECT price, pix_price INTO v_price, v_pix_price 
          FROM public.product_variants WHERE id = v_variant_id;
        END IF;
      ELSIF v_item_type = 'promotion' THEN
        SELECT name, image_url, price, pix_price INTO v_name, v_image_url, v_price, v_pix_price 
        FROM public.promotions WHERE id = v_item_id;
      END IF;

      v_final_item_price := CASE WHEN v_is_pix AND v_pix_price > 0 THEN v_pix_price ELSE v_price END;
      total_cart_price := total_cart_price + (COALESCE(v_final_item_price, 0) * v_quantity);
    END;
  END LOOP;

  -- 2. Calcular preço final
  final_price := GREATEST(0, total_cart_price);
  
  -- IMPORTANTE: total_price DEVE incluir frete e doação
  DECLARE
    v_final_total numeric;
  BEGIN
    v_final_total := final_price + p_shipping_cost + p_donation_amount;
  END;

  -- 3. Criar pedido para convidado
  INSERT INTO public.orders (
    user_id,
    guest_email,
    total_price, -- AGORA INCLUI FRETE E DOAÇÃO
    shipping_cost,
    shipping_address,
    status,
    payment_method,
    donation_amount
  )
  VALUES (
    NULL,
    p_email,
    v_final_total, -- TOTAL CORRETO: produtos + frete + doação
    p_shipping_cost,
    p_shipping_address,
    'Aguardando Pagamento',
    CASE WHEN v_is_pix THEN 'Pix' ELSE 'Cartão de Crédito' END,
    p_donation_amount
  )
  RETURNING id INTO new_order_id;

  -- 4. Gravar itens do pedido
  FOR item_json IN SELECT jsonb_array_elements(p_cart_items)
  LOOP
    DECLARE
      v_item_id bigint := (item_json->>'itemId')::bigint;
      v_item_type text := item_json->>'itemType';
      v_quantity integer := (item_json->>'quantity')::integer;
      v_variant_id uuid := (item_json->>'variantId')::uuid;
      v_name text;
      v_image_url text;
      v_price numeric;
      v_pix_price numeric;
      v_final_item_price numeric;
    BEGIN
      IF v_item_type = 'product' THEN
        SELECT name, image_url, price, pix_price INTO v_name, v_image_url, v_price, v_pix_price 
        FROM public.products WHERE id = v_item_id;
        
        IF v_variant_id IS NOT NULL THEN
          SELECT pv.price, pv.pix_price, f.name INTO v_price, v_pix_price, v_name
          FROM public.product_variants pv 
          LEFT JOIN public.flavors f ON pv.flavor_id = f.id 
          WHERE pv.id = v_variant_id;
          
          v_name := v_name || ' - ' || COALESCE((SELECT name FROM public.flavors WHERE id = (SELECT flavor_id FROM public.product_variants WHERE id = v_variant_id)), 'Opção');
        END IF;
        
        -- Deduzir estoque do produto
        IF v_variant_id IS NOT NULL THEN
          UPDATE public.product_variants SET stock_quantity = stock_quantity - v_quantity WHERE id = v_variant_id;
        ELSE
          UPDATE public.products SET stock_quantity = stock_quantity - v_quantity WHERE id = v_item_id;
        END IF;
      ELSIF v_item_type = 'promotion' THEN
        SELECT name, image_url, price, pix_price INTO v_name, v_image_url, v_price, v_pix_price 
        FROM public.promotions WHERE id = v_item_id;
        
        UPDATE public.promotions SET stock_quantity = stock_quantity - v_quantity WHERE id = v_item_id;
      END IF;

      v_final_item_price := CASE WHEN v_is_pix AND v_pix_price > 0 THEN v_pix_price ELSE v_price END;

      INSERT INTO public.order_items (order_id, item_id, item_type, quantity, price_at_purchase, name_at_purchase, image_url_at_purchase)
      VALUES (new_order_id, v_item_id, v_item_type, v_quantity, v_final_item_price, v_name, v_image_url);
    END;
  END LOOP;

  SELECT new_order_id, v_final_total INTO result_record;
  RETURN result_record;
END;
$function$;