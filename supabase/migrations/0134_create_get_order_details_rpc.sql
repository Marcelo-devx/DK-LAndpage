-- Criar função RPC para buscar pedido com perfil e itens (JOIN manual)
-- Isso evita problemas de relacionamento do Supabase

CREATE OR REPLACE FUNCTION public.get_order_details_with_profile(p_order_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_data jsonb;
  v_profile_data jsonb;
  v_items_data jsonb;
  v_result jsonb;
BEGIN
  -- Buscar dados do pedido
  SELECT row_to_json(o)::jsonb INTO v_order_data
  FROM public.orders o
  WHERE o.id = p_order_id;
  
  IF v_order_data IS NULL THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado');
  END IF;
  
  -- Buscar dados do perfil (se user_id existir)
  IF (v_order_data->>'user_id') IS NOT NULL THEN
    SELECT row_to_json(p)::jsonb INTO v_profile_data
    FROM public.profiles p
    WHERE p.id = (v_order_data->>'user_id')::uuid;
  END IF;
  
  -- Buscar itens do pedido
  SELECT jsonb_agg(row_to_json(oi)) INTO v_items_data
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id;
  
  -- Montar resultado no formato esperado pela edge function
  v_result := v_order_data ||
    jsonb_build_object(
      'profiles', CASE WHEN v_profile_data IS NOT NULL 
        THEN jsonb_build_array(v_profile_data) 
        ELSE jsonb_build_array()::jsonb 
      END,
      'order_items', COALESCE(v_items_data, jsonb_build_array())
    );
  
  RETURN v_result;
END;
$$;

-- Garantir que a função tem permissão de execução para authenticated e service_role
GRANT EXECUTE ON FUNCTION public.get_order_details_with_profile(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_details_with_profile(bigint) TO service_role;

-- Testar a função
DO $$
DECLARE
  v_test_result jsonb;
BEGIN
  -- Buscar um pedido aleatório para teste
  SELECT get_order_details_with_profile(id) INTO v_test_result
  FROM public.orders
  LIMIT 1;
  
  IF v_test_result IS NOT NULL THEN
    RAISE NOTICE 'Teste da RPC get_order_details_with_profile: SUCESSO';
  ELSE
    RAISE NOTICE 'Teste da RPC get_order_details_with_profile: Sem pedidos no banco';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Teste da RPC falhou: %', SQLERRM;
END $$;