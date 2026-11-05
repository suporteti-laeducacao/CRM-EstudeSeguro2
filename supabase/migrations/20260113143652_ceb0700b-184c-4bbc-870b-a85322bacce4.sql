-- Create credores table
CREATE TABLE public.credores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('vendedor', 'administrativo', 'fornecedor', 'outros')),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contas_pagar table
CREATE TABLE public.contas_pagar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  credor_id UUID NOT NULL REFERENCES public.credores(id) ON DELETE RESTRICT,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('comissao', 'salario', 'vale', 'fornecedor', 'despesa_fixa', 'despesa_variavel', 'outros')),
  valor NUMERIC NOT NULL CHECK (valor > 0),
  data_vencimento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado')),
  forma_pagamento TEXT,
  data_pagamento DATE,
  observacoes TEXT,
  comprovante_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

-- RLS policies for credores
CREATE POLICY "Authenticated users can view all credores" 
ON public.credores FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert credores" 
ON public.credores FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update credores" 
ON public.credores FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete credores" 
ON public.credores FOR DELETE USING (true);

-- RLS policies for contas_pagar
CREATE POLICY "Authenticated users can view all contas_pagar" 
ON public.contas_pagar FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert contas_pagar" 
ON public.contas_pagar FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update contas_pagar" 
ON public.contas_pagar FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete contas_pagar" 
ON public.contas_pagar FOR DELETE USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_credores_updated_at
BEFORE UPDATE ON public.credores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contas_pagar_updated_at
BEFORE UPDATE ON public.contas_pagar
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();