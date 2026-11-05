
CREATE OR REPLACE FUNCTION public.get_ranking_sales()
RETURNS TABLE(id uuid, seller text, payment_mode text, tipo_boleto text, status text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.seller, s.payment_mode, s.tipo_boleto, s.status
  FROM public.sales s
  WHERE auth.uid() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_ranking_installments()
RETURNS TABLE(
  id uuid, sale_id uuid, installment_number integer, status text,
  paid_date date, paid_amount numeric, value numeric,
  full_value numeric, company_value numeric, is_repasse boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.sale_id, i.installment_number, i.status, i.paid_date,
         i.paid_amount, i.value, i.full_value, i.company_value, i.is_repasse
  FROM public.installments i
  WHERE auth.uid() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_ranking_payments()
RETURNS TABLE(id uuid, installment_id uuid, valor numeric, data_pagamento date)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.installment_id, p.valor, p.data_pagamento
  FROM public.installment_payments p
  WHERE auth.uid() IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_ranking_sales() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking_installments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking_payments() TO authenticated;
