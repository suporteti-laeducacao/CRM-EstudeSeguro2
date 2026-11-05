
-- Tabela de metas gerais (empresa/equipe)
CREATE TABLE public.metas_gerais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  valor NUMERIC NOT NULL,
  periodo TEXT NOT NULL DEFAULT 'mensal',
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de metas por vendedor
CREATE TABLE public.metas_vendedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vendedor_id UUID NOT NULL REFERENCES public.vendedores(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL,
  periodo TEXT NOT NULL DEFAULT 'mensal',
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for metas_gerais
ALTER TABLE public.metas_gerais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e Gerentes podem ver metas_gerais"
  ON public.metas_gerais FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'vendedor'));

CREATE POLICY "Admins e Gerentes podem inserir metas_gerais"
  ON public.metas_gerais FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente'));

CREATE POLICY "Admins e Gerentes podem atualizar metas_gerais"
  ON public.metas_gerais FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente'));

CREATE POLICY "Admins e Gerentes podem deletar metas_gerais"
  ON public.metas_gerais FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente'));

-- RLS for metas_vendedores
ALTER TABLE public.metas_vendedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver metas_vendedores"
  ON public.metas_vendedores FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'vendedor'));

CREATE POLICY "Admins e Gerentes podem inserir metas_vendedores"
  ON public.metas_vendedores FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente'));

CREATE POLICY "Admins e Gerentes podem atualizar metas_vendedores"
  ON public.metas_vendedores FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente'));

CREATE POLICY "Admins e Gerentes podem deletar metas_vendedores"
  ON public.metas_vendedores FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente'));

-- Trigger for updated_at
CREATE TRIGGER update_metas_gerais_updated_at
  BEFORE UPDATE ON public.metas_gerais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_metas_vendedores_updated_at
  BEFORE UPDATE ON public.metas_vendedores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
