ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS recurrence_type text,
  ADD COLUMN IF NOT EXISTS recurrence_interval integer,
  ADD COLUMN IF NOT EXISTS recurrence_unit text,
  ADD COLUMN IF NOT EXISTS recurrence_end_type text,
  ADD COLUMN IF NOT EXISTS recurrence_count integer,
  ADD COLUMN IF NOT EXISTS recurrence_end_date date,
  ADD COLUMN IF NOT EXISTS recurrence_group_id uuid,
  ADD COLUMN IF NOT EXISTS installment_number integer,
  ADD COLUMN IF NOT EXISTS installment_total integer;

ALTER TABLE public.contas_pagar
  ADD CONSTRAINT contas_pagar_recurrence_type_check
  CHECK (recurrence_type IS NULL OR recurrence_type IN ('none','monthly','quarterly','semiannual','annual','custom'));

ALTER TABLE public.contas_pagar
  ADD CONSTRAINT contas_pagar_recurrence_unit_check
  CHECK (recurrence_unit IS NULL OR recurrence_unit IN ('day','month','year'));

ALTER TABLE public.contas_pagar
  ADD CONSTRAINT contas_pagar_recurrence_end_type_check
  CHECK (recurrence_end_type IS NULL OR recurrence_end_type IN ('count','date'));

CREATE INDEX IF NOT EXISTS idx_contas_pagar_recurrence_group ON public.contas_pagar (recurrence_group_id);