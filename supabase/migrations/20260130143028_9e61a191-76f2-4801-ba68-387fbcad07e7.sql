-- Drop existing permissive policies on contas_pagar
DROP POLICY IF EXISTS "Authenticated users can delete contas_pagar" ON public.contas_pagar;
DROP POLICY IF EXISTS "Authenticated users can insert contas_pagar" ON public.contas_pagar;
DROP POLICY IF EXISTS "Authenticated users can update contas_pagar" ON public.contas_pagar;
DROP POLICY IF EXISTS "Authenticated users can view all contas_pagar" ON public.contas_pagar;

-- Create restrictive policies for finance/management (admin, gerente only)
CREATE POLICY "Admins e Gerentes podem ver contas_pagar"
ON public.contas_pagar
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role)
);

CREATE POLICY "Admins e Gerentes podem inserir contas_pagar"
ON public.contas_pagar
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role)
);

CREATE POLICY "Admins e Gerentes podem atualizar contas_pagar"
ON public.contas_pagar
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role)
);

CREATE POLICY "Admins e Gerentes podem deletar contas_pagar"
ON public.contas_pagar
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role)
);