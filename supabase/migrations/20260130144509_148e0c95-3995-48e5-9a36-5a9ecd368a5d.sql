-- ============================================
-- ADDITIONAL RLS SECURITY FIXES - PHASE 2
-- Fix remaining permissive policies
-- ============================================

-- ============================================
-- 1. LEADS - Fix INSERT policy (currently allows any authenticated)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON public.leads;

CREATE POLICY "Users can insert leads with proper user_id"
ON public.leads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- ============================================
-- 2. SALES - Fix INSERT policy (currently allows any authenticated)
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can insert sales" ON public.sales;

CREATE POLICY "Users can insert sales with proper user_id"
ON public.sales FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- ============================================
-- 3. LEAD_HISTORY - Align with leads visibility
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view all lead_history" ON public.lead_history;
DROP POLICY IF EXISTS "Authenticated users can insert lead_history" ON public.lead_history;

CREATE POLICY "Privileged can view lead_history"
ON public.lead_history FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role) OR
  user_id = auth.uid()
);

CREATE POLICY "Users can insert lead_history with proper user_id"
ON public.lead_history FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- ============================================
-- 4. LEAD_MESSAGES - Align with leads visibility
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view all lead_messages" ON public.lead_messages;
DROP POLICY IF EXISTS "Authenticated users can insert lead_messages" ON public.lead_messages;

CREATE POLICY "Privileged can view lead_messages"
ON public.lead_messages FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);

CREATE POLICY "System can insert lead_messages"
ON public.lead_messages FOR INSERT TO authenticated
WITH CHECK (true); -- Messages are inserted via sync, need service role

-- ============================================
-- 5. VENDEDORES - Restrict SELECT to privileged roles only
-- (removing public visibility for contact info protection)
-- ============================================
DROP POLICY IF EXISTS "Authenticated can view vendedores" ON public.vendedores;

CREATE POLICY "Privileged can view vendedores"
ON public.vendedores FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role) OR
  user_id = auth.uid()
);