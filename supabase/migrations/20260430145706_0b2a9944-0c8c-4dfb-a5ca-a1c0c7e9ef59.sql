ALTER TABLE public.lead_tasks ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.set_lead_task_completed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.concluida = true AND (OLD.concluida IS DISTINCT FROM true) THEN
    NEW.completed_at = now();
  ELSIF NEW.concluida = false THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_task_completed_at ON public.lead_tasks;
CREATE TRIGGER trg_lead_task_completed_at
BEFORE UPDATE ON public.lead_tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_lead_task_completed_at();

UPDATE public.lead_tasks SET completed_at = created_at WHERE concluida = true AND completed_at IS NULL;