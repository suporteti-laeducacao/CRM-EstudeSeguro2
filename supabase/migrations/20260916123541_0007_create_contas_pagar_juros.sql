CREATE TABLE public.contas_pagar_juros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conta_pagar_id uuid NOT NULL REFERENCES public.contas_pagar(id) ON DELETE CASCADE,
  credor_id uuid,
  descricao text,
  categoria text,
  valor_original numeric NOT NULL DEFAULT 0,
  valor_pago numeric NOT NULL DEFAULT 0,
  valor_juros numeric NOT NULL DEFAULT 0,
  data_vencimento date,
  data_pagamento date NOT NULL,
  dias_atraso integer,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_pagar_juros TO authenticated;
GRANT ALL ON public.contas_pagar_juros TO service_role;

ALTER TABLE public.contas_pagar_juros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem ver juros"
ON public.contas_pagar_juros FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados podem inserir juros"
ON public.contas_pagar_juros FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Gestao pode atualizar juros"
ON public.contas_pagar_juros FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente') OR public.has_role(auth.uid(),'financeiro'));

CREATE POLICY "Gestao pode excluir juros"
ON public.contas_pagar_juros FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));

CREATE INDEX idx_contas_pagar_juros_data_pagamento ON public.contas_pagar_juros(data_pagamento);
CREATE INDEX idx_contas_pagar_juros_conta ON public.contas_pagar_juros(conta_pagar_id);