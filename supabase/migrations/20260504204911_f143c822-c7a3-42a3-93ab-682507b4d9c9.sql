
-- 1) Coluna para registrar quem concluiu a tarefa
ALTER TABLE public.lead_tasks
  ADD COLUMN IF NOT EXISTS completed_by uuid;

-- 2) Trigger atualizada: registra completed_at e completed_by
CREATE OR REPLACE FUNCTION public.set_lead_task_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.concluida = true AND (OLD.concluida IS DISTINCT FROM true) THEN
    NEW.completed_at = now();
    NEW.completed_by = COALESCE(NEW.completed_by, auth.uid());
  ELSIF NEW.concluida = false THEN
    NEW.completed_at = NULL;
    NEW.completed_by = NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_lead_task_completed_at ON public.lead_tasks;
CREATE TRIGGER trg_set_lead_task_completed_at
BEFORE UPDATE ON public.lead_tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_lead_task_completed_at();

-- 3) RLS: permitir admin/supervisor/gerente e o vendedor atual do lead atualizarem tarefas
DROP POLICY IF EXISTS "Users can update own lead_tasks" ON public.lead_tasks;
CREATE POLICY "Privileged or owner or current vendor can update lead_tasks"
ON public.lead_tasks
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR (user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.leads l
    JOIN public.vendedores v ON v.id = l.vendedor_id
    WHERE l.id = lead_tasks.lead_id AND v.user_id = auth.uid()
  )
);
