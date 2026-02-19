-- 1. Adicionar coluna de doação na tabela de pedidos
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS donation_amount numeric DEFAULT 0;

-- 2. Atualizar a função de criação de pedido para aceitar a doação
CREATE OR REPLACE FUNCTION public.create_pending_order_from_local_cart(
    shipping_cost_input numeric,
    shipping_address_input jsonb,
    cart_items_input jsonb,
    user_coupon_id_input bigint DEFAULT NULL::bigint,
    benefits_input text DEFAULT NULL::text,
    payment_method_input text DEFAULT 'credit_card'::text,
    donation_amount_input numeric DEFAULT 0 -- Novo Parâmetro
)
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
  item_pix_price numeric;
  final_item_price numeric;
  item_name text;
  item_image_url text;
  item_stock integer;
  is_pix boolean;
  payment_method_label text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  is_pix := (payment_method_input = 'pix');
  
  IF is_pix THEN
    payment_method_label := 'PIX via WhatsApp';
  ELSE
    payment_method_label := 'Cartão de Crédito';
  END IF;

  -- 1. Verificar estoque de TODOS os itens
  FOR item_json IN SELECT jsonb_array_elements(cart_items_input)
  LOOP
    DECLARE
      v_item_id bigint := (item_json->>'itemId')::bigint;
      v_item_type text := item_json->>'itemType';
      v_quantity integer := (item_json->>'quantity')::integer;
      v_variant_id uuid := (item_json->>'variantId')::uuid;
    BEGIN
      IF v_item_type = 'product' THEN
        IF v_variant_id IS NOT NULL THEN
            SELECT pv.stock_quantity INTO item_stock FROM public.product_variants pv WHERE pv.id = v_variant_id FOR UPDATE;
        ELSE
            SELECT stock_quantity INTO item_stock FROM public.products WHERE id = v_item_id FOR UPDATE;
        END IF;
      ELSIF v_item_type = 'promotion' THEN
        SELECT stock_quantity INTO item_stock FROM public.promotions WHERE id = v_item_id FOR UPDATE;
      END IF;

      IF item_stock < v_quantity THEN 
        RAISE EXCEPTION 'Estoque insuficiente para um ou mais itens. Recarregue a página.'; 
      END IF;
    END;
  END LOOP;

  -- 2. Calcular preço e DEDUZIR estoque
  FOR item_json IN SELECT jsonb_array_elements(cart_items_input)
  LOOP
    DECLARE
      v_item_id bigint := (item_json->>'itemId')::bigint;
      v_item_type text := item_json->>'itemType';
      v_quantity integer := (item_json->>'quantity')::integer;
      v_variant_id uuid := (item_json->>'variantId')::uuid;
    BEGIN
      IF v_item_type = 'product' THEN
        SELECT name, price, pix_price INTO item_name, item_price, item_pix_price FROM public.products WHERE id = v_item_id;
        
        IF v_variant_id IS NOT NULL THEN
            SELECT pv.price, pv.pix_price, f.name, pv.volume_ml, pv.ohms, pv.color 
            INTO item_price, item_pix_price, item_name, item_stock, item_name, item_name -- placeholders
            FROM public.product_variants pv 
            LEFT JOIN public.flavors f ON pv.flavor_id = f.id 
            WHERE pv.id = v_variant_id;
            
            -- Recalcular nome completo da variação para o histórico
            SELECT 
                p.name || 
                CASE WHEN f.name IS NOT NULL THEN ' - ' || f.name ELSE '' END ||
                CASE WHEN pv.volume_ml IS NOT NULL THEN ' - ' || pv.volume_ml || 'ml' ELSE '' END ||
                CASE WHEN pv.ohms IS NOT NULL THEN ' - ' || pv.ohms ELSE '' END ||
                CASE WHEN pv.color IS NOT NULL THEN ' - ' || pv.color ELSE '' END
            INTO item_name 
            FROM public.products p
            LEFT JOIN public.product_variants pv ON pv.id = v_variant_id
            LEFT JOIN public.flavors f ON pv.flavor_id = f.id
            WHERE p.id = v_item_id;
            
            UPDATE public.product_variants SET stock_quantity = stock_quantity - v_quantity WHERE id = v_variant_id;
        ELSE
            UPDATE public.products SET stock_quantity = stock_quantity - v_quantity WHERE id = v_item_id;
        END IF;

      ELSIF v_item_type = 'promotion' THEN
        SELECT price, pix_price INTO item_price, item_pix_price FROM public.promotions WHERE id = v_item_id;
        UPDATE public.promotions SET stock_quantity = stock_quantity - v_quantity WHERE id = v_item_id;
      END IF;

      IF is_pix AND item_pix_price IS NOT NULL AND item_pix_price > 0 THEN
        final_item_price := item_pix_price;
      ELSE
        final_item_price := item_price;
      END IF;

      total_cart_price := total_cart_price + (final_item_price * v_quantity);
    END;
  END LOOP;

  -- 3. Lidar com o cupom
  IF user_coupon_id_input IS NOT NULL THEN
    SELECT c.discount_value, c.minimum_order_value INTO discount_amount, coupon_min_value
    FROM public.user_coupons uc JOIN public.coupons c ON uc.coupon_id = c.id
    WHERE uc.id = user_coupon_id_input AND uc.user_id = current_user_id AND uc.is_used = false AND uc.expires_at > now();
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Cupom inválido ou já utilizado.'; END IF;
    IF total_cart_price < coupon_min_value THEN RAISE EXCEPTION 'O valor do pedido não atinge o mínimo para usar este cupom.'; END IF;
  END IF;

  -- 4. Cálculo final (Preço Produtos - Desconto + Doação)
  -- Nota: O shipping_cost é salvo separado na tabela, mas o total_price geralmente o inclui ou é base de cálculo.
  -- Aqui definiremos total_price como o valor final PAGÁVEL (Produtos - Desconto + Doação). O frete é somado visualmente ou aqui se preferir.
  -- Padrão atual do sistema: orders.total_price armazena o valor dos PRODUTOS com desconto aplicado. 
  -- O donation_amount será salvo separado e somado no total final a pagar.
  
  final_price := total_cart_price - discount_amount;
  IF final_price < 0 THEN final_price := 0; END IF;
  
  -- Adiciona a doação ao total final que vai ser cobrado (IMPORTANTE: A doação não sofre desconto)
  -- No banco, 'total_price' representa o valor líquido dos produtos.
  -- A doação fica na coluna 'donation_amount'.
  
  INSERT INTO public.orders (
    user_id, 
    total_price, -- Valor dos produtos (com desconto)
    shipping_cost, 
    shipping_address, 
    status, 
    coupon_discount, 
    benefits_used, 
    payment_method,
    donation_amount -- Nova coluna
  )
  VALUES (
    current_user_id, 
    final_price, 
    shipping_cost_input, 
    shipping_address_input, 
    'Aguardando Pagamento', 
    discount_amount, 
    benefits_input, 
    payment_method_label,
    donation_amount_input
  )
  RETURNING id INTO new_order_id;

  -- 5. Vincula o cupom ao pedido
  IF user_coupon_id_input IS NOT NULL THEN
    UPDATE public.user_coupons SET is_used = true, order_id = new_order_id WHERE id = user_coupon_id_input;
  END IF;

  -- 6. Inserir itens do pedido
  FOR item_json IN SELECT jsonb_array_elements(cart_items_input)
  LOOP
    DECLARE
      v_item_id bigint := (item_json->>'itemId')::bigint;
      v_item_type text := item_json->>'itemType';
      v_quantity integer := (item_json->>'quantity')::integer;
      v_variant_id uuid := (item_json->>'variantId')::uuid;
    BEGIN
      IF v_item_type = 'product' THEN
        SELECT name, image_url, price, pix_price INTO item_name, item_image_url, item_price, item_pix_price FROM public.products WHERE id = v_item_id;
        
        IF v_variant_id IS NOT NULL THEN
            SELECT pv.price, pv.pix_price, f.name INTO item_price, item_pix_price, item_name
            FROM public.product_variants pv LEFT JOIN public.flavors f ON pv.flavor_id = f.id WHERE pv.id = v_variant_id;
            
            -- Recalcular nome completo igual acima
            SELECT 
                p.name || 
                CASE WHEN f.name IS NOT NULL THEN ' - ' || f.name ELSE '' END ||
                CASE WHEN pv.volume_ml IS NOT NULL THEN ' - ' || pv.volume_ml || 'ml' ELSE '' END ||
                CASE WHEN pv.ohms IS NOT NULL THEN ' - ' || pv.ohms ELSE '' END ||
                CASE WHEN pv.color IS NOT NULL THEN ' - ' || pv.color ELSE '' END
            INTO item_name 
            FROM public.products p
            LEFT JOIN public.product_variants pv ON pv.id = v_variant_id
            LEFT JOIN public.flavors f ON pv.flavor_id = f.id
            WHERE p.id = v_item_id;
        END IF;
      ELSIF v_item_type = 'promotion' THEN
        SELECT price, pix_price, name, image_url INTO item_price, item_pix_price, item_name, item_image_url FROM public.promotions WHERE id = v_item_id;
      END IF;

      IF is_pix AND item_pix_price IS NOT NULL AND item_pix_price > 0 THEN
        final_item_price := item_pix_price;
      ELSE
        final_item_price := item_price;
      END IF;

      INSERT INTO public.order_items (order_id, item_id, item_type, quantity, price_at_purchase, name_at_purchase, image_url_at_purchase)
      VALUES (new_order_id, v_item_id, v_item_type, v_quantity, final_item_price, item_name, item_image_url);
    END;
  END LOOP;

  -- O valor retornado para o frontend/pagamento deve ser a soma TOTAL (Produtos + Frete + Doação)
  SELECT new_order_id, (final_price + shipping_cost_input + donation_amount_input) INTO result_record;
  RETURN result_record;
END;
$function$;