-- Adiciona a coluna de quantidade de estoque na tabela de cupons
ALTER TABLE public.coupons
ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0;

-- Define um estoque inicial para os cupons já existentes
UPDATE public.coupons SET stock_quantity = 999;

-- Atualiza a função de resgate de cupom para verificar e decrementar o estoque
CREATE OR REPLACE FUNCTION public.redeem_coupon(coupon_id_to_redeem bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  user_points INT;
  coupon_cost INT;
  coupon_stock INT;
BEGIN
  -- Pega os pontos do usuário e o custo/estoque do cupom
  SELECT points INTO user_points FROM public.profiles WHERE id = current_user_id;
  SELECT points_cost, stock_quantity INTO coupon_cost, coupon_stock FROM public.coupons WHERE id = coupon_id_to_redeem;

  -- Verifica se o cupom existe
  IF coupon_cost IS NULL THEN
    RAISE EXCEPTION 'Cupom não encontrado.';
  END IF;

  -- Verifica se o cupom está em estoque
  IF coupon_stock <= 0 THEN
    RAISE EXCEPTION 'Este cupom está esgotado.';
  END IF;

  -- Verifica se o usuário tem pontos suficientes
  IF user_points < coupon_cost THEN
    RAISE EXCEPTION 'Pontos insuficientes para resgatar este cupom.';
  END IF;

  -- Subtrai os pontos do perfil do usuário
  UPDATE public.profiles
  SET points = points - coupon_cost
  WHERE id = current_user_id;

  -- Decrementa o estoque do cupom
  UPDATE public.coupons
  SET stock_quantity = stock_quantity - 1
  WHERE id = coupon_id_to_redeem;

  -- Insere o cupom na tabela de cupons do usuário
  INSERT INTO public.user_coupons (user_id, coupon_id)
  VALUES (current_user_id, coupon_id_to_redeem);

  RETURN 'Cupom resgatado com sucesso!';
END;
$$;