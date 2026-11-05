
-- Table for recurring payment configurations
CREATE TABLE public.recorrencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  credor_id UUID NOT NULL REFERENCES public.credores(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  forma_pagamento TEXT,
  observacoes TEXT,
  recorrencia TEXT NOT NULL DEFAULT 'mensal', -- mensal, trimestral, semestral, anual
  dia_vencimento INTEGER NOT NULL DEFAULT 1, -- day of month for due date
  proxima_geracao DATE NOT NULL, -- next date to generate an installment
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.recorrencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e Gerentes podem ver recorrencias" ON public.recorrencias
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role)
  );

CREATE POLICY "Admins e Gerentes podem inserir recorrencias" ON public.recorrencias
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role)
  );

CREATE POLICY "Admins e Gerentes podem atualizar recorrencias" ON public.recorrencias
  FOR UPDATE USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role)
  );

CREATE POLICY "Admins e Gerentes podem deletar recorrencias" ON public.recorrencias
  FOR DELETE USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role)
  );

-- Trigger for updated_at
CREATE TRIGGER update_recorrencias_updated_at
  BEFORE UPDATE ON public.recorrencias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
