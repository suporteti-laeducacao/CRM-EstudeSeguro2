CREATE TABLE public.installment_juros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  installment_id uuid NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  sale_id uuid,
  student_name text,
  valor_parcela numeric NOT NULL,
  valor_recebido numeric NOT NULL,
  valor_juros numeric NOT NULL,
  data_vencimento date,
  data_pagamento date NOT NULL,
  dias_atraso integer,
  metodo text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.installment_juros TO authenticated;
GRANT ALL ON public.installment_juros TO service_role;
ALTER TABLE public.installment_juros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insert own juros" ON public.installment_juros FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Select juros" ON public.installment_juros FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "Manage juros" ON public.installment_juros FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "Delete juros" ON public.installment_juros FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'gerente'));
CREATE INDEX idx_installment_juros_data ON public.installment_juros(data_pagamento);