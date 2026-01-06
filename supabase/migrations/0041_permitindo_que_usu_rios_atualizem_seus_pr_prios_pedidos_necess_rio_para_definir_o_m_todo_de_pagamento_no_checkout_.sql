-- Adiciona a política de UPDATE para a tabela orders
CREATE POLICY "Users can update their own orders" ON public.orders
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);