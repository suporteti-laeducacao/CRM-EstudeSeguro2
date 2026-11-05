-- Add columns to lead_tasks for recall workflow
ALTER TABLE public.lead_tasks 
  ADD COLUMN IF NOT EXISTS cancelada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS rechamada_ordem integer,
  ADD COLUMN IF NOT EXISTS rechamada_ciclo integer;

CREATE INDEX IF NOT EXISTS idx_lead_tasks_lead_id ON public.lead_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_tipo ON public.lead_tasks(tipo);