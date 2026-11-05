DROP POLICY IF EXISTS "Autenticados leem contatos de acompanhamento" ON public.acompanhamento_contatos;

CREATE POLICY "Leitura de contatos por perfil"
ON public.acompanhamento_contatos
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR is_vendedor_of(vendedor_id)
);

DROP POLICY IF EXISTS "Autenticados registram contatos" ON public.acompanhamento_contatos;

CREATE POLICY "Registro de contatos por perfil"
ON public.acompanhamento_contatos
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR is_vendedor_of(vendedor_id)
);