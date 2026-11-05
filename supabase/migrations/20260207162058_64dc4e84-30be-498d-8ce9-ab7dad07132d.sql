-- Drop existing policies for categorias_conta
DROP POLICY IF EXISTS "Users can view their own categories" ON public.categorias_conta;
DROP POLICY IF EXISTS "Users can create their own categories" ON public.categorias_conta;
DROP POLICY IF EXISTS "Users can update their own categories" ON public.categorias_conta;
DROP POLICY IF EXISTS "Users can delete their own categories" ON public.categorias_conta;

-- Create RLS Policies matching contas_pagar access (admin and gerente only)
CREATE POLICY "Admins e Gerentes podem ver categorias"
  ON public.categorias_conta
  FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente'));

CREATE POLICY "Admins e Gerentes podem inserir categorias"
  ON public.categorias_conta
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente'));

CREATE POLICY "Admins e Gerentes podem atualizar categorias"
  ON public.categorias_conta
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente'));

CREATE POLICY "Admins e Gerentes podem deletar categorias"
  ON public.categorias_conta
  FOR DELETE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente'));