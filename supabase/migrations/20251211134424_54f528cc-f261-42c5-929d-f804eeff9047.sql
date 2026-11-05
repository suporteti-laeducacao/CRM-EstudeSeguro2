-- Criar tabela de grupos de repasse
CREATE TABLE public.grupos_repasse (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  porcentagem_empresa NUMERIC NOT NULL CHECK (porcentagem_empresa >= 0 AND porcentagem_empresa <= 100),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.grupos_repasse ENABLE ROW LEVEL SECURITY;

-- RLS Policies for grupos_repasse (collaborative access)
CREATE POLICY "Authenticated users can view all grupos_repasse" 
ON public.grupos_repasse FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert grupos_repasse" 
ON public.grupos_repasse FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update grupos_repasse" 
ON public.grupos_repasse FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete grupos_repasse" 
ON public.grupos_repasse FOR DELETE USING (true);

-- Adicionar campos na tabela sales para boletos com repasse
ALTER TABLE public.sales ADD COLUMN tipo_boleto TEXT DEFAULT 'proprio';
ALTER TABLE public.sales ADD COLUMN grupo_repasse_id UUID REFERENCES public.grupos_repasse(id);
ALTER TABLE public.sales ADD COLUMN valor_total_boleto NUMERIC;
ALTER TABLE public.sales ADD COLUMN porcentagem_aplicada NUMERIC;
ALTER TABLE public.sales ADD COLUMN valor_empresa NUMERIC;