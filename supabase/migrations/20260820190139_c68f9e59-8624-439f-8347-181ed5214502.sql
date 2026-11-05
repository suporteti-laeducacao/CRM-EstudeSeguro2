-- STUDENTS
DROP POLICY IF EXISTS "Authenticated can view students" ON public.students;
DROP POLICY IF EXISTS "Authenticated can insert students" ON public.students;
DROP POLICY IF EXISTS "Authenticated can update students" ON public.students;

CREATE POLICY "Privileged or owner can view students" ON public.students FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente')
  OR has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'financeiro')
);

CREATE POLICY "Privileged or owner can insert students" ON public.students FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente')
  OR has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'financeiro')
);

CREATE POLICY "Privileged or owner can update students" ON public.students FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente')
  OR has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'financeiro')
)
WITH CHECK (
  auth.uid() = user_id
  OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente')
  OR has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'financeiro')
);

-- GRUPOS REPASSE
DROP POLICY IF EXISTS "Authenticated can view grupos_repasse" ON public.grupos_repasse;
CREATE POLICY "Privileged can view grupos_repasse" ON public.grupos_repasse FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente') OR has_role(auth.uid(),'financeiro'));

-- RANKING EXCLUSIONS
DROP POLICY IF EXISTS "Authenticated can view ranking exclusions" ON public.ranking_exclusions;
CREATE POLICY "Privileged can view ranking exclusions" ON public.ranking_exclusions FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente') OR has_role(auth.uid(),'financeiro'));

-- VENDEDORES
DROP POLICY IF EXISTS "Authenticated can view vendedores" ON public.vendedores;
CREATE POLICY "Privileged or self can view vendedores" ON public.vendedores FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente')
  OR has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'financeiro')
);

CREATE OR REPLACE FUNCTION public.get_vendedores_basic(_apenas_ativos boolean DEFAULT true)
RETURNS TABLE(id uuid, user_id uuid, nome text, ativo boolean, foto_url text, email text, telefone text, sunchat_user_id text, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT v.id, v.user_id, v.nome, v.ativo, v.foto_url,
    CASE WHEN v.user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente')
              OR has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'financeiro')
         THEN v.email ELSE NULL END,
    CASE WHEN v.user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente')
              OR has_role(auth.uid(),'supervisor') OR has_role(auth.uid(),'financeiro')
         THEN v.telefone ELSE NULL END,
    CASE WHEN v.user_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente')
         THEN v.sunchat_user_id ELSE NULL END,
    v.created_at, v.updated_at
  FROM public.vendedores v
  WHERE auth.uid() IS NOT NULL
    AND (NOT _apenas_ativos OR v.ativo IS TRUE)
  ORDER BY v.nome
$$;

REVOKE ALL ON FUNCTION public.get_vendedores_basic(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vendedores_basic(boolean) TO authenticated, service_role;

-- STORAGE POLICIES
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
           AND (COALESCE(qual,'') ILIKE '%comprovantes%' OR COALESCE(with_check,'') ILIKE '%comprovantes%'
                OR COALESCE(qual,'') ILIKE '%user-photos%' OR COALESCE(with_check,'') ILIKE '%user-photos%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "comprovantes read own or privileged" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'comprovantes' AND (owner = auth.uid()
  OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente') OR has_role(auth.uid(),'financeiro')));

CREATE POLICY "comprovantes insert own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'comprovantes' AND owner = auth.uid());

CREATE POLICY "comprovantes update own or privileged" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'comprovantes' AND (owner = auth.uid()
  OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente') OR has_role(auth.uid(),'financeiro')));

CREATE POLICY "comprovantes delete own or privileged" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'comprovantes' AND (owner = auth.uid()
  OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente') OR has_role(auth.uid(),'financeiro')));

CREATE POLICY "user photos read authenticated" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'user-photos');

CREATE POLICY "user photos insert admin" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-photos' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente')));

CREATE POLICY "user photos update admin" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'user-photos' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente')));

CREATE POLICY "user photos delete admin" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'user-photos' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gerente')));

-- FUNCTION EXECUTE HARDENING
REVOKE ALL ON FUNCTION public.check_lead_telefone_duplicado(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_lead_telefone_duplicado(text, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_ranking_installments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ranking_installments() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_ranking_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ranking_payments() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_ranking_sales() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ranking_sales() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_user_roles(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_vendedor_of(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_vendedor_of(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_system_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_lead_task_completed_at() FROM PUBLIC, anon, authenticated;