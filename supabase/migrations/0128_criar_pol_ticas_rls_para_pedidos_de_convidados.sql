-- Criar política para permitir inserção de pedidos de convidados
CREATE POLICY "Guests can insert orders" ON public.orders
FOR INSERT TO anon
WITH CHECK (true);

-- Criar política para permitir que convidados vejam seus próprios pedidos pelo email
CREATE POLICY "Guests can view their own orders by email" ON public.orders
FOR SELECT TO anon
USING (guest_email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR guest_email IS NOT NULL);

-- Criar política para permitir que convidados atualizem seus pedidos pelo email
CREATE POLICY "Guests can update their own orders by email" ON public.orders
FOR UPDATE TO anon
USING (guest_email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR guest_email IS NOT NULL)
WITH CHECK (guest_email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR guest_email IS NOT NULL);