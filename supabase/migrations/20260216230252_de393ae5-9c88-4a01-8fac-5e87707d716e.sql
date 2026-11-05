
-- Create sale_change_logs table for audit trail
CREATE TABLE public.sale_change_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT
);

-- Enable RLS
ALTER TABLE public.sale_change_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Privileged can view sale_change_logs"
ON public.sale_change_logs
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role) OR
  (user_id = auth.uid())
);

CREATE POLICY "Authenticated can insert sale_change_logs"
ON public.sale_change_logs
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Index for fast lookups by sale
CREATE INDEX idx_sale_change_logs_sale_id ON public.sale_change_logs(sale_id);
CREATE INDEX idx_sale_change_logs_changed_at ON public.sale_change_logs(changed_at DESC);
