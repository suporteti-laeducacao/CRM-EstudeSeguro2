-- Tighten access control for Sales Forecast (negocios)
-- Replace overly-permissive policies with role-based visibility and write permissions.

ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;

-- Remove old permissive policies
DROP POLICY IF EXISTS "Authenticated users can view all negocios" ON public.negocios;
DROP POLICY IF EXISTS "Authenticated users can insert negocios" ON public.negocios;
DROP POLICY IF EXISTS "Authenticated users can update all negocios" ON public.negocios;
DROP POLICY IF EXISTS "Authenticated users can delete all negocios" ON public.negocios;

-- SELECT
CREATE POLICY "Privileged can view all negocios"
ON public.negocios
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Vendedor can view own negocios"
ON public.negocios
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.vendedores v
    WHERE v.user_id = auth.uid()
      AND v.id = public.negocios.vendedor_id
  )
);

-- INSERT
CREATE POLICY "Privileged can insert negocios"
ON public.negocios
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Vendedor can insert own negocios"
ON public.negocios
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.vendedores v
    WHERE v.user_id = auth.uid()
      AND v.id = public.negocios.vendedor_id
  )
);

-- UPDATE
CREATE POLICY "Privileged can update all negocios"
ON public.negocios
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'supervisor')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Vendedor can update own negocios"
ON public.negocios
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.vendedores v
    WHERE v.user_id = auth.uid()
      AND v.id = public.negocios.vendedor_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.vendedores v
    WHERE v.user_id = auth.uid()
      AND v.id = public.negocios.vendedor_id
  )
);

-- DELETE
CREATE POLICY "Privileged can delete all negocios"
ON public.negocios
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Vendedor can delete own negocios"
ON public.negocios
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.vendedores v
    WHERE v.user_id = auth.uid()
      AND v.id = public.negocios.vendedor_id
  )
);
