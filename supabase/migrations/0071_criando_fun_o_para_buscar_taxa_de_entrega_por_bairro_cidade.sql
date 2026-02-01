CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.get_shipping_rate(p_neighborhood text, p_city text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_price numeric;
BEGIN
  -- Tenta encontrar o preço exato para o bairro e cidade
  SELECT price INTO v_price
  FROM public.shipping_rates
  WHERE unaccent(lower(neighborhood)) = unaccent(lower(p_neighborhood))
    AND unaccent(lower(city)) = unaccent(lower(p_city))
    AND is_active = true
  LIMIT 1;

  -- Se não encontrar (mas for Curitiba, por exemplo), pode ter uma taxa fixa geral ou retorna NULL
  -- Aqui retornamos NULL para o front tratar como "A Combinar" ou buscar taxa padrão
  
  RETURN v_price;
END;
$$;