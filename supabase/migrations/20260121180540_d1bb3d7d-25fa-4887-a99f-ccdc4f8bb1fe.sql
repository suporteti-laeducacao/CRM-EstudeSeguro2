-- Drop existing SELECT policies on leads
DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;
DROP POLICY IF EXISTS "Admin and Supervisor can view all leads" ON public.leads;

-- Create new SELECT policy for leads:
-- Admins and Supervisors can see ALL leads
-- Vendedores can only see their OWN leads (either by user_id or vendedor_id)
CREATE POLICY "Leads visibility based on role"
ON public.leads
FOR SELECT
USING (
  -- Admins can see all
  public.has_role(auth.uid(), 'admin')
  OR
  -- Supervisors can see all
  public.has_role(auth.uid(), 'supervisor')
  OR
  -- Gerentes can see all
  public.has_role(auth.uid(), 'gerente')
  OR
  -- Vendedores can see leads they created OR leads assigned to them
  (
    user_id = auth.uid()
    OR
    vendedor_id IN (SELECT id FROM public.vendedores WHERE user_id = auth.uid())
  )
);

-- Update policy for leads to allow supervisors to update (assign vendedor)
DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;

CREATE POLICY "Leads update based on role"
ON public.leads
FOR UPDATE
USING (
  -- Admins can update all
  public.has_role(auth.uid(), 'admin')
  OR
  -- Supervisors can update all
  public.has_role(auth.uid(), 'supervisor')
  OR
  -- Gerentes can update all
  public.has_role(auth.uid(), 'gerente')
  OR
  -- Vendedores can update leads they created OR leads assigned to them
  (
    user_id = auth.uid()
    OR
    vendedor_id IN (SELECT id FROM public.vendedores WHERE user_id = auth.uid())
  )
);