-- Atualizar política SELECT da tabela sales para incluir supervisor
DROP POLICY IF EXISTS "Users can view sales based on role" ON public.sales;
CREATE POLICY "Users can view sales based on role" 
ON public.sales 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  (user_id = auth.uid())
);

-- Atualizar política SELECT da tabela installments para incluir supervisor
DROP POLICY IF EXISTS "Authenticated users can view all installments" ON public.installments;
CREATE POLICY "Users can view installments based on role" 
ON public.installments 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'supervisor'::app_role) OR 
  (user_id = auth.uid())
);