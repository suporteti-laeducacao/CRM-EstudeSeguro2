
CREATE TABLE public.installment_change_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  installment_id UUID NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  campo TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  descricao TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.installment_change_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged can view installment_change_logs"
ON public.installment_change_logs
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'gerente') OR
  has_role(auth.uid(), 'supervisor') OR
  user_id = auth.uid()
);

CREATE POLICY "Authenticated can insert installment_change_logs"
ON public.installment_change_logs
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_installment_change_logs_installment_id ON public.installment_change_logs(installment_id);
CREATE INDEX idx_installment_change_logs_created_at ON public.installment_change_logs(created_at);
