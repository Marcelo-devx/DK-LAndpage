-- Correção da função create_guest_order
-- O total_price deve incluir: subtotal - desconto + frete + doação

CREATE OR REPLACE FUNCTION public.create_guest_order(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_cpf_cnpj text,
  p_shipping_cost numeric,
  p_shipping_address jsonb,
  p_cart_items jsonb,
  p_payment_method text DEFAULT 'pix'::text,
  p_donation_amount numeric DEFAULT 0
)
RETURNS record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $function$
DECLARE
  total_cart_price numeric := 0;
  new_order_id bigint;
  final_price numeric; -- Valor dos produtos (com desconto)
  final_total_price numeric; -- TOTAL REAL que deve ser salvo em total_price
  result_record record;
  item_json jsonb; 
  
  -- Variáveis temporárias
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
BEGIN
  v_is_pix := (p_payment_method ILIKE '%pix%');

  -- 1. Loop: Calcular Subtotal (Baseado no estoque atual)
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

  -- 2. Cálculo Final
  -- Subtotal dos produtos (convidados não têm desconto de cupom nesta função)
  final_price := total_cart_price;

  -- 3. Criar o cabeçalho do pedido
  -- IMPORTANTE: total_price agora deve incluir frete e doação
  final_total_price := final_price + p_shipping_cost + p_donation_amount;
  
  INSERT INTO public.orders (
      user_id,
      total_price, -- TOTAL COMPLETO (produtos + frete + doação)
      shipping_cost, 
      shipping_address, 
      status, 
      coupon_discount, 
      payment_method, 
      donation_amount,
      guest_email,
      guest_phone,
      guest_cpf_cnpj
  )
  VALUES (
      NULL, -- Convidado não tem user_id
      final_total_price, 
      p_shipping_cost, 
      p_shipping_address, 
      'Aguardando Pagamento', 
      0, -- Sem desconto de cupom
      CASE WHEN v_is_pix THEN 'Pix' ELSE 'Cartão de Crédito' END, 
      p_donation_amount,
      p_email,
      p_phone,
      p_cpf_cnpj
  )
  RETURNING id INTO new_order_id;

  -- 4. Loop: Gravar Itens e Deduzir Estoque
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

  SELECT new_order_id, final_total_price INTO result_record;
  RETURN result_record;
END;
$function$;