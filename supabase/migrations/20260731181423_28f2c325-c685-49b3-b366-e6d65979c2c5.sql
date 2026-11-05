
CREATE OR REPLACE FUNCTION public.is_vendedor_of(_vendedor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendedores v
    WHERE v.id = _vendedor_id AND v.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_vendedor_of(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can view sales based on role" ON public.sales;
CREATE POLICY "Users can view sales based on role"
ON public.sales FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor')
  OR has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'financeiro')
  OR user_id = auth.uid()
  OR public.is_vendedor_of(vendedor_id)
);

DROP POLICY IF EXISTS "Users can view installments based on role" ON public.installments;
CREATE POLICY "Users can view installments based on role"
ON public.installments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor')
  OR has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'financeiro')
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = installments.sale_id AND public.is_vendedor_of(s.vendedor_id)
  )
);

DROP POLICY IF EXISTS "Privileged can view installment_payments" ON public.installment_payments;
CREATE POLICY "Privileged can view installment_payments"
ON public.installment_payments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente')
  OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'financeiro')
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.installments i
    JOIN public.sales s ON s.id = i.sale_id
    WHERE i.id = installment_payments.installment_id AND public.is_vendedor_of(s.vendedor_id)
  )
);
