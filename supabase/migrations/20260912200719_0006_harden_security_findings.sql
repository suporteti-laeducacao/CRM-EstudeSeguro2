-- 1. Revoke anon EXECUTE on SECURITY DEFINER trigger function
REVOKE ALL ON FUNCTION public.log_certificacao_status() FROM PUBLIC, anon;

-- 2. certificacoes_historico: align SELECT with certificacoes access model
DROP POLICY IF EXISTS "Users can view certificacoes historico" ON public.certificacoes_historico;
CREATE POLICY "Users can view certificacoes historico"
ON public.certificacoes_historico
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.certificacoes c
    WHERE c.id = certificacoes_historico.certificacao_id
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'gerente'::app_role)
        OR has_role(auth.uid(), 'supervisor'::app_role)
        OR has_role(auth.uid(), 'financeiro'::app_role)
        OR c.user_id = auth.uid()
        OR is_vendedor_of(c.vendedor_id)
      )
  )
);

-- 3. recorrencias / categorias_conta / lancamentos_campanha / sale_change_logs -> authenticated only
DROP POLICY IF EXISTS "Privileged can view recorrencias" ON public.recorrencias;
CREATE POLICY "Privileged can view recorrencias" ON public.recorrencias FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
DROP POLICY IF EXISTS "Privileged can insert recorrencias" ON public.recorrencias;
CREATE POLICY "Privileged can insert recorrencias" ON public.recorrencias FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
DROP POLICY IF EXISTS "Privileged can update recorrencias" ON public.recorrencias;
CREATE POLICY "Privileged can update recorrencias" ON public.recorrencias FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
DROP POLICY IF EXISTS "Privileged can delete recorrencias" ON public.recorrencias;
CREATE POLICY "Privileged can delete recorrencias" ON public.recorrencias FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));

DROP POLICY IF EXISTS "Privileged can view categorias" ON public.categorias_conta;
CREATE POLICY "Privileged can view categorias" ON public.categorias_conta FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
DROP POLICY IF EXISTS "Privileged can insert categorias" ON public.categorias_conta;
CREATE POLICY "Privileged can insert categorias" ON public.categorias_conta FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
DROP POLICY IF EXISTS "Privileged can update categorias" ON public.categorias_conta;
CREATE POLICY "Privileged can update categorias" ON public.categorias_conta FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
DROP POLICY IF EXISTS "Privileged can delete categorias" ON public.categorias_conta;
CREATE POLICY "Privileged can delete categorias" ON public.categorias_conta FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));

DROP POLICY IF EXISTS "Privileged can view lancamentos_campanha" ON public.lancamentos_campanha;
CREATE POLICY "Privileged can view lancamentos_campanha" ON public.lancamentos_campanha FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'supervisor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));
DROP POLICY IF EXISTS "Privileged can insert lancamentos_campanha" ON public.lancamentos_campanha;
CREATE POLICY "Privileged can insert lancamentos_campanha" ON public.lancamentos_campanha FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));
DROP POLICY IF EXISTS "Privileged can update lancamentos_campanha" ON public.lancamentos_campanha;
CREATE POLICY "Privileged can update lancamentos_campanha" ON public.lancamentos_campanha FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));
DROP POLICY IF EXISTS "Privileged can delete lancamentos_campanha" ON public.lancamentos_campanha;
CREATE POLICY "Privileged can delete lancamentos_campanha" ON public.lancamentos_campanha FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));

DROP POLICY IF EXISTS "Privileged can view sale_change_logs" ON public.sale_change_logs;
CREATE POLICY "Privileged can view sale_change_logs" ON public.sale_change_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role) OR has_role(auth.uid(),'supervisor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role) OR user_id = auth.uid());
DROP POLICY IF EXISTS "Authenticated can insert sale_change_logs" ON public.sale_change_logs;
CREATE POLICY "Authenticated can insert sale_change_logs" ON public.sale_change_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- 4. leads SELECT/UPDATE -> authenticated only
DROP POLICY IF EXISTS "Leads visibility based on role" ON public.leads;
CREATE POLICY "Leads visibility based on role" ON public.leads FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role) OR has_role(auth.uid(),'gerente'::app_role)
  OR user_id = auth.uid()
  OR vendedor_id IN (SELECT v.id FROM public.vendedores v WHERE v.user_id = auth.uid())
);
DROP POLICY IF EXISTS "Leads update based on role" ON public.leads;
CREATE POLICY "Leads update based on role" ON public.leads FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'supervisor'::app_role) OR has_role(auth.uid(),'gerente'::app_role)
  OR user_id = auth.uid()
  OR vendedor_id IN (SELECT v.id FROM public.vendedores v WHERE v.user_id = auth.uid())
);

-- 5. user-photos: only files linked to a vendedor record, own uploads, or privileged roles
DROP POLICY IF EXISTS "user photos read authenticated" ON storage.objects;
CREATE POLICY "user photos read authenticated" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'user-photos'
  AND (
    owner = auth.uid()
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'gerente'::app_role)
    OR EXISTS (SELECT 1 FROM public.vendedores v WHERE v.foto_url = storage.objects.name)
  )
);