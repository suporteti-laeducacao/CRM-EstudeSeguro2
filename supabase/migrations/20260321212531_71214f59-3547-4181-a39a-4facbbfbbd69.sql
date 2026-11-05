-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "Privileged can view vendedores" ON public.vendedores;

-- Create a new policy allowing all authenticated users to view vendedores
-- (same pattern as cursos and grupos_repasse tables)
CREATE POLICY "Authenticated can view vendedores"
  ON public.vendedores
  FOR SELECT
  TO authenticated
  USING (true);