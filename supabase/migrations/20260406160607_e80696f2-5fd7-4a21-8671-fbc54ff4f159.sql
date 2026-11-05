
CREATE TABLE public.installment_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  installment_id UUID NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  valor NUMERIC NOT NULL,
  data_pagamento DATE NOT NULL,
  metodo TEXT NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged can view installment_payments"
ON public.installment_payments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'gerente') OR
  has_role(auth.uid(), 'supervisor') OR
  user_id = auth.uid()
);

CREATE POLICY "Privileged can insert installment_payments"
ON public.installment_payments
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'gerente') OR
  has_role(auth.uid(), 'supervisor') OR
  user_id = auth.uid()
);
