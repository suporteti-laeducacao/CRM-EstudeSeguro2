-- ============================================
-- COMPREHENSIVE RLS SECURITY FIX
-- Replace all permissive USING(true) policies with role-based access
-- ============================================

-- ============================================
-- 1. VENDEDORES - All authenticated can view (needed for dropdowns), 
--    but only admins/gerentes can modify
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can delete all vendedores" ON public.vendedores;
DROP POLICY IF EXISTS "Authenticated users can insert vendedores" ON public.vendedores;
DROP POLICY IF EXISTS "Authenticated users can update all vendedores" ON public.vendedores;
DROP POLICY IF EXISTS "Authenticated users can view all vendedores" ON public.vendedores;

-- Keep SELECT open for all authenticated (needed for dropdown lists, sales forms)
CREATE POLICY "Authenticated can view vendedores"
ON public.vendedores FOR SELECT TO authenticated
USING (true);

-- Only admins can insert/update/delete vendedores
CREATE POLICY "Admins can insert vendedores"
ON public.vendedores FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update vendedores"
ON public.vendedores FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete vendedores"
ON public.vendedores FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- 2. CLIENTES - Privileged roles only (sensitive customer data)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can delete all clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can insert clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can update all clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can view all clientes" ON public.clientes;

CREATE POLICY "Privileged can view clientes"
ON public.clientes FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Privileged can insert clientes"
ON public.clientes FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Privileged can update clientes"
ON public.clientes FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Privileged can delete clientes"
ON public.clientes FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- ============================================
-- 3. ATIVIDADES - Privileged roles only
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can delete all atividades" ON public.atividades;
DROP POLICY IF EXISTS "Authenticated users can insert atividades" ON public.atividades;
DROP POLICY IF EXISTS "Authenticated users can update all atividades" ON public.atividades;
DROP POLICY IF EXISTS "Authenticated users can view all atividades" ON public.atividades;

CREATE POLICY "Privileged can view atividades"
ON public.atividades FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Privileged can insert atividades"
ON public.atividades FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Privileged can update atividades"
ON public.atividades FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Privileged can delete atividades"
ON public.atividades FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- ============================================
-- 4. CURSOS - All authenticated can view (needed for forms), admins modify
-- ============================================
DROP POLICY IF EXISTS "All authenticated users can create cursos" ON public.cursos;
DROP POLICY IF EXISTS "All authenticated users can delete cursos" ON public.cursos;
DROP POLICY IF EXISTS "All authenticated users can update cursos" ON public.cursos;
DROP POLICY IF EXISTS "All authenticated users can view all cursos" ON public.cursos;

CREATE POLICY "Authenticated can view cursos"
ON public.cursos FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can insert cursos"
ON public.cursos FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role));

CREATE POLICY "Admins can update cursos"
ON public.cursos FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role));

CREATE POLICY "Admins can delete cursos"
ON public.cursos FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role));

-- ============================================
-- 5. CAMPANHAS_TRAFEGO - Marketing data, privileged only
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can delete all campanhas_trafego" ON public.campanhas_trafego;
DROP POLICY IF EXISTS "Authenticated users can insert campanhas_trafego" ON public.campanhas_trafego;
DROP POLICY IF EXISTS "Authenticated users can update all campanhas_trafego" ON public.campanhas_trafego;
DROP POLICY IF EXISTS "Authenticated users can view all campanhas_trafego" ON public.campanhas_trafego;

CREATE POLICY "Privileged can view campanhas_trafego"
ON public.campanhas_trafego FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Privileged can insert campanhas_trafego"
ON public.campanhas_trafego FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role)
);

CREATE POLICY "Privileged can update campanhas_trafego"
ON public.campanhas_trafego FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role)
);

CREATE POLICY "Privileged can delete campanhas_trafego"
ON public.campanhas_trafego FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role)
);

-- ============================================
-- 6. GRUPOS_REPASSE - Financial commission data, privileged only
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can delete grupos_repasse" ON public.grupos_repasse;
DROP POLICY IF EXISTS "Authenticated users can insert grupos_repasse" ON public.grupos_repasse;
DROP POLICY IF EXISTS "Authenticated users can update grupos_repasse" ON public.grupos_repasse;
DROP POLICY IF EXISTS "Authenticated users can view all grupos_repasse" ON public.grupos_repasse;

-- Keep SELECT open (needed for sales forms to select repasse group)
CREATE POLICY "Authenticated can view grupos_repasse"
ON public.grupos_repasse FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can insert grupos_repasse"
ON public.grupos_repasse FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role));

CREATE POLICY "Admins can update grupos_repasse"
ON public.grupos_repasse FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role));

CREATE POLICY "Admins can delete grupos_repasse"
ON public.grupos_repasse FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role));

-- ============================================
-- 7. CREDORES - Financial data, admin/gerente only
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can delete credores" ON public.credores;
DROP POLICY IF EXISTS "Authenticated users can insert credores" ON public.credores;
DROP POLICY IF EXISTS "Authenticated users can update credores" ON public.credores;
DROP POLICY IF EXISTS "Authenticated users can view all credores" ON public.credores;

CREATE POLICY "Admins e Gerentes podem ver credores"
ON public.credores FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role));

CREATE POLICY "Admins e Gerentes podem inserir credores"
ON public.credores FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role));

CREATE POLICY "Admins e Gerentes podem atualizar credores"
ON public.credores FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role));

CREATE POLICY "Admins e Gerentes podem deletar credores"
ON public.credores FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role));

-- ============================================
-- 8. COLLECTION_ATTEMPTS - Financial data, privileged only
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can delete all collection attempts" ON public.collection_attempts;
DROP POLICY IF EXISTS "Authenticated users can insert collection attempts" ON public.collection_attempts;
DROP POLICY IF EXISTS "Authenticated users can update all collection attempts" ON public.collection_attempts;
DROP POLICY IF EXISTS "Authenticated users can view all collection attempts" ON public.collection_attempts;

CREATE POLICY "Privileged can view collection_attempts"
ON public.collection_attempts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Privileged can insert collection_attempts"
ON public.collection_attempts FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Privileged can update collection_attempts"
ON public.collection_attempts FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "Privileged can delete collection_attempts"
ON public.collection_attempts FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

-- ============================================
-- 9. INSTALLMENTS - Fix INSERT/UPDATE/DELETE policies
-- SELECT already has role filtering
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can delete all installments" ON public.installments;
DROP POLICY IF EXISTS "Authenticated users can insert installments" ON public.installments;
DROP POLICY IF EXISTS "Authenticated users can update all installments" ON public.installments;

CREATE POLICY "Privileged can insert installments"
ON public.installments FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role) OR
  user_id = auth.uid()
);

CREATE POLICY "Privileged can update installments"
ON public.installments FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role) OR
  user_id = auth.uid()
);

CREATE POLICY "Privileged can delete installments"
ON public.installments FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  user_id = auth.uid()
);

-- ============================================
-- 10. LEAD_NOTES - Tied to leads visibility
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can delete lead_notes" ON public.lead_notes;
DROP POLICY IF EXISTS "Authenticated users can insert lead_notes" ON public.lead_notes;
DROP POLICY IF EXISTS "Authenticated users can update lead_notes" ON public.lead_notes;
DROP POLICY IF EXISTS "Authenticated users can view all lead_notes" ON public.lead_notes;

CREATE POLICY "Privileged can view lead_notes"
ON public.lead_notes FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role) OR
  user_id = auth.uid()
);

CREATE POLICY "Authenticated can insert lead_notes"
ON public.lead_notes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own lead_notes"
ON public.lead_notes FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own lead_notes"
ON public.lead_notes FOR DELETE TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- 11. LEAD_TASKS - Tied to leads visibility
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can delete lead_tasks" ON public.lead_tasks;
DROP POLICY IF EXISTS "Authenticated users can insert lead_tasks" ON public.lead_tasks;
DROP POLICY IF EXISTS "Authenticated users can update lead_tasks" ON public.lead_tasks;
DROP POLICY IF EXISTS "Authenticated users can view all lead_tasks" ON public.lead_tasks;

CREATE POLICY "Privileged can view lead_tasks"
ON public.lead_tasks FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role) OR
  user_id = auth.uid()
);

CREATE POLICY "Authenticated can insert lead_tasks"
ON public.lead_tasks FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own lead_tasks"
ON public.lead_tasks FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own lead_tasks"
ON public.lead_tasks FOR DELETE TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- 12. Make user-photos bucket private
-- ============================================
UPDATE storage.buckets 
SET public = false 
WHERE id = 'user-photos';

-- Add policy for authenticated users to view photos
DROP POLICY IF EXISTS "Authenticated users can view user photos" ON storage.objects;
CREATE POLICY "Authenticated users can view user photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'user-photos');