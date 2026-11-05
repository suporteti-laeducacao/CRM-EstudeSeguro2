CREATE OR REPLACE FUNCTION public.set_lead_task_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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