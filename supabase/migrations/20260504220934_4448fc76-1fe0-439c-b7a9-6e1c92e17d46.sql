-- Permitir que o vendedor atualmente atribuído ao lead também VEJA as tarefas
DROP POLICY IF EXISTS "Privileged can view lead_tasks" ON public.lead_tasks;

CREATE POLICY "Privileged or owner or current vendor can view lead_tasks"
ON public.lead_tasks
FOR SELECT
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