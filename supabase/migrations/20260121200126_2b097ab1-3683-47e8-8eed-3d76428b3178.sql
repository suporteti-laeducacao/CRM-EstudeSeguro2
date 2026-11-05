-- Expand privileged visibility to include 'gerente' for sales and installments

-- SALES: replace SELECT policy to include gerente
DROP POLICY IF EXISTS "Users can view sales based on role" ON public.sales;
CREATE POLICY "Users can view sales based on role"
ON public.sales
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR (user_id = auth.uid())
);

-- INSTALLMENTS: replace SELECT policy to include gerente
DROP POLICY IF EXISTS "Users can view installments based on role" ON public.installments;
CREATE POLICY "Users can view installments based on role"
ON public.installments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR (user_id = auth.uid())
);
