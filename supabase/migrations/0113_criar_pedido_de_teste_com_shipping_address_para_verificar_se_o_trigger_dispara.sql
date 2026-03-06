-- Testar se o trigger está funcionando criando um pedido de teste
INSERT INTO public.orders (
  user_id,
  total_price,
  shipping_cost,
  status,
  payment_method,
  shipping_address,
  created_at
) VALUES (
  '4ca330e1-4a32-4991-8042-d1ced2c30b3f',
  0.01,
  0,
  'Teste Trigger',
  'Pix',
  '{"cep": "81150-080", "city": "Curitiba", "state": "PR"}'::jsonb,
  NOW()
)
RETURNING id;