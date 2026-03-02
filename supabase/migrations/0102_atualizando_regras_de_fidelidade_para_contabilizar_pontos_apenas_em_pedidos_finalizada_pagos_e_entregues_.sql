-- 1. Atualiza a função que processa a entrada de pontos no momento da conclusão
CREATE OR REPLACE FUNCTION public.process_loyalty_on_order_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_multiplier NUMERIC;
    v_base_points INT;
    v_bonus_points INT := 0;
    v_orders_this_month INT;
    v_referrer_id UUID;
    v_referral_record_id BIGINT;
    
    -- Variáveis de Configuração
    cfg_ticket_threshold NUMERIC;
    cfg_ticket_bonus INT;
    cfg_rec_2 INT;
    cfg_rec_3 INT;
    cfg_rec_4 INT;
    cfg_ref_bonus INT;
BEGIN
    -- REGRA ATUALIZADA: Só roda se o status mudou para 'Finalizada'
    IF NEW.status = 'Finalizada' AND OLD.status <> 'Finalizada' THEN
        
        -- Carregar configurações (com fallback)
        SELECT COALESCE(value::numeric, 500) INTO cfg_ticket_threshold FROM public.app_settings WHERE key = 'loyalty_ticket_threshold';
        SELECT COALESCE(value::int, 10) INTO cfg_ticket_bonus FROM public.app_settings WHERE key = 'loyalty_ticket_bonus';
        SELECT COALESCE(value::int, 5) INTO cfg_rec_2 FROM public.app_settings WHERE key = 'loyalty_recurrence_2nd';
        SELECT COALESCE(value::int, 10) INTO cfg_rec_3 FROM public.app_settings WHERE key = 'loyalty_recurrence_3rd';
        SELECT COALESCE(value::int, 15) INTO cfg_rec_4 FROM public.app_settings WHERE key = 'loyalty_recurrence_4th';
        SELECT COALESCE(value::int, 50) INTO cfg_ref_bonus FROM public.app_settings WHERE key = 'loyalty_referral_bonus';

        -- 1. Buscar multiplicador do nível atual
        SELECT t.points_multiplier INTO v_multiplier
        FROM public.profiles p
        JOIN public.loyalty_tiers t ON p.tier_id = t.id
        WHERE p.id = NEW.user_id;

        -- Pontos base (Valor * Multiplicador)
        v_base_points := FLOOR(NEW.total_price * COALESCE(v_multiplier, 1));

        -- 2. Bônus Ticket Alto
        IF NEW.total_price >= cfg_ticket_threshold THEN
            v_bonus_points := v_bonus_points + cfg_ticket_bonus;
        END IF;

        -- 3. Bônus Recorrência Mensal (Apenas pedidos Finalizados no mês)
        SELECT COUNT(*) INTO v_orders_this_month
        FROM public.orders
        WHERE user_id = NEW.user_id
          AND status = 'Finalizada'
          AND date_trunc('month', created_at) = date_trunc('month', NOW());
        
        IF v_orders_this_month = 2 THEN v_bonus_points := v_bonus_points + cfg_rec_2; END IF;
        IF v_orders_this_month = 3 THEN v_bonus_points := v_bonus_points + cfg_rec_3; END IF;
        IF v_orders_this_month >= 4 THEN v_bonus_points := v_bonus_points + cfg_rec_4; END IF;

        -- 4. Inserir pontos no histórico e perfil
        INSERT INTO public.loyalty_history (user_id, points, description, operation_type, related_order_id)
        VALUES (NEW.user_id, (v_base_points + v_bonus_points), 'Compra #' || NEW.id, 'earn', NEW.id);

        UPDATE public.profiles 
        SET points = points + v_base_points + v_bonus_points
        WHERE id = NEW.user_id;

        -- 5. Recalcular nível (Tier)
        PERFORM public.recalculate_user_tier(NEW.user_id);

        -- 6. Lógica de Indicação (Member Get Member)
        SELECT id, referrer_id INTO v_referral_record_id, v_referrer_id
        FROM public.referrals
        WHERE referred_id = NEW.user_id AND status = 'registered';

        IF v_referral_record_id IS NOT NULL THEN
            INSERT INTO public.loyalty_history (user_id, points, description, operation_type)
            VALUES (v_referrer_id, cfg_ref_bonus, 'Bônus por Indicação', 'earn');

            UPDATE public.profiles SET points = points + cfg_ref_bonus WHERE id = v_referrer_id;
            UPDATE public.referrals SET status = 'completed' WHERE id = v_referral_record_id;
        END IF;

    END IF;
    RETURN NEW;
END;
$function$;

-- 2. Atualiza a função de recálculo de nível para considerar apenas gastos 'Finalizada'
CREATE OR REPLACE FUNCTION public.recalculate_user_tier(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_total_spend NUMERIC;
    v_new_tier_id INT;
    v_new_tier_name TEXT;
BEGIN
    -- REGRA ATUALIZADA: Apenas pedidos com status 'Finalizada' contam para o gasto semestral
    SELECT COALESCE(SUM(total_price), 0)
    INTO v_total_spend
    FROM public.orders
    WHERE user_id = target_user_id
      AND status = 'Finalizada'
      AND created_at >= (NOW() - INTERVAL '6 months');

    -- Descobre qual nível esse valor representa
    SELECT id, name INTO v_new_tier_id, v_new_tier_name
    FROM public.loyalty_tiers
    WHERE v_total_spend >= min_spend 
      AND (max_spend IS NULL OR v_total_spend <= max_spend)
    ORDER BY min_spend DESC
    LIMIT 1;

    -- Atualiza o perfil
    IF v_new_tier_id IS NOT NULL THEN
        UPDATE public.profiles
        SET 
            spend_last_6_months = v_total_spend,
            tier_id = v_new_tier_id,
            current_tier_name = v_new_tier_name,
            last_tier_update = NOW()
        WHERE id = target_user_id;
    END IF;
END;
$function$;

-- 3. Atualiza a função de sincronização forçada
CREATE OR REPLACE FUNCTION public.sync_loyalty_history()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_coupons_count integer;
  v_orders_count integer;
BEGIN
  -- Sincronizar Cupons (Saída)
  WITH inserted_coupons AS (
    INSERT INTO public.loyalty_history (user_id, points, description, operation_type, created_at)
    SELECT uc.user_id, -(c.points_cost), 'Resgate de Cupom: ' || c.name, 'redeem', uc.created_at
    FROM public.user_coupons uc
    JOIN public.coupons c ON uc.coupon_id = c.id
    WHERE NOT EXISTS (
        SELECT 1 FROM public.loyalty_history lh 
        WHERE lh.user_id = uc.user_id AND lh.operation_type = 'redeem' AND lh.created_at = uc.created_at
    )
    RETURNING id
  )
  SELECT count(*) INTO v_coupons_count FROM inserted_coupons;

  -- Sincronizar Pedidos (Entrada)
  -- REGRA ATUALIZADA: Apenas status 'Finalizada'
  WITH inserted_orders AS (
    INSERT INTO public.loyalty_history (user_id, points, description, operation_type, related_order_id, created_at)
    SELECT o.user_id, FLOOR(o.total_price), 'Compra #' || o.id, 'earn', o.id, o.created_at
    FROM public.orders o
    WHERE o.status = 'Finalizada'
    AND o.total_price > 0
    AND NOT EXISTS (
        SELECT 1 FROM public.loyalty_history lh WHERE lh.related_order_id = o.id
    )
    RETURNING id
  )
  SELECT count(*) INTO v_orders_count FROM inserted_orders;

  -- Atualizar saldo total
  UPDATE public.profiles p
  SET points = (SELECT COALESCE(SUM(points), 0) FROM public.loyalty_history lh WHERE lh.user_id = p.id)
  WHERE EXISTS (SELECT 1 FROM public.loyalty_history lh WHERE lh.user_id = p.id);
  
  RETURN 'Sincronização: ' || v_coupons_count || ' cupons e ' || v_orders_count || ' pedidos finalizados recuperados.';
END;
$function$;