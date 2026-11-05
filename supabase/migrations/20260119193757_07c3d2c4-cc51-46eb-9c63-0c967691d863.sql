-- Drop existing SELECT policies on sales
DROP POLICY IF EXISTS "Authenticated users can view all sales" ON public.sales;

-- Drop existing SELECT policies on leads
DROP POLICY IF EXISTS "Authenticated users can view all leads" ON public.leads;

-- Create new SELECT policy for sales: Admins see all, others see only their own
CREATE POLICY "Users can view sales based on role"
ON public.sales
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR user_id = auth.uid()
);

-- Create new SELECT policy for leads: Admins see all, others see only their own
CREATE POLICY "Users can view leads based on role"
ON public.leads
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR user_id = auth.uid()
);

-- Update UPDATE policies for sales
DROP POLICY IF EXISTS "Authenticated users can update all sales" ON public.sales;
CREATE POLICY "Users can update sales based on role"
ON public.sales
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR user_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR user_id = auth.uid()
);

-- Update UPDATE policies for leads
DROP POLICY IF EXISTS "Authenticated users can update leads" ON public.leads;
CREATE POLICY "Users can update leads based on role"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR user_id = auth.uid()
);

-- Update DELETE policies for sales
DROP POLICY IF EXISTS "Authenticated users can delete all sales" ON public.sales;
CREATE POLICY "Users can delete sales based on role"
ON public.sales
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR user_id = auth.uid()
);

-- Update DELETE policies for leads
DROP POLICY IF EXISTS "Authenticated users can delete leads" ON public.leads;
CREATE POLICY "Users can delete leads based on role"
ON public.leads
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR user_id = auth.uid()
);