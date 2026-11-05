CREATE TABLE public.certificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  aluno_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf TEXT,
  certificadora TEXT,
  nivel_ensino TEXT,
  curso TEXT,
  vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL,
  notas TEXT,
  status TEXT NOT NULL DEFAULT 'pendente_documentos',
  data_solicitacao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_envio_certificadora DATE,
  data_emissao DATE,
  data_entrega DATE,
  prazo_previsto DATE,
  canal_entrega TEXT,
  apto_nova_oferta BOOLEAN NOT NULL DEFAULT false,
  data_ultimo_contato_pos_certificacao DATE,
  resultado_contato TEXT NOT NULL DEFAULT 'nao_contatado',
  is_segunda_via BOOLEAN NOT NULL DEFAULT false,
  motivo_cancelamento TEXT,
  promessa_certificacao DATE,
  previsao_certificacao DATE,
  cliente_origem_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificacoes TO authenticated;
GRANT ALL ON public.certificacoes TO service_role;

ALTER TABLE public.certificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view certificacoes based on role" ON public.certificacoes
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'financeiro') OR user_id = auth.uid() OR is_vendedor_of(vendedor_id));

CREATE POLICY "Users can insert certificacoes" ON public.certificacoes
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update certificacoes based on role" ON public.certificacoes
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'financeiro') OR user_id = auth.uid() OR is_vendedor_of(vendedor_id))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'financeiro') OR user_id = auth.uid() OR is_vendedor_of(vendedor_id));

CREATE POLICY "Users can delete certificacoes based on role" ON public.certificacoes
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gerente') OR has_role(auth.uid(), 'supervisor') OR user_id = auth.uid());

CREATE INDEX idx_certificacoes_aluno_id ON public.certificacoes(aluno_id);
CREATE INDEX idx_certificacoes_status ON public.certificacoes(status);
CREATE INDEX idx_certificacoes_data_entrega ON public.certificacoes(data_entrega);
CREATE INDEX idx_certificacoes_vendedor_id ON public.certificacoes(vendedor_id);

CREATE TRIGGER trg_certificacoes_updated_at
BEFORE UPDATE ON public.certificacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.certificacoes_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificacao_id UUID NOT NULL REFERENCES public.certificacoes(id) ON DELETE CASCADE,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  usuario_id UUID,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.certificacoes_historico TO authenticated;
GRANT ALL ON public.certificacoes_historico TO service_role;

ALTER TABLE public.certificacoes_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view certificacoes historico" ON public.certificacoes_historico
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.certificacoes c WHERE c.id = certificacao_id));

CREATE POLICY "Users can insert certificacoes historico" ON public.certificacoes_historico
FOR INSERT TO authenticated
WITH CHECK (usuario_id = auth.uid());

CREATE INDEX idx_cert_hist_certificacao_id ON public.certificacoes_historico(certificacao_id);

CREATE OR REPLACE FUNCTION public.log_certificacao_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.certificacoes_historico (certificacao_id, status_anterior, status_novo, usuario_id)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.certificacoes_historico (certificacao_id, status_anterior, status_novo, usuario_id)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_certificacoes_status_log
AFTER INSERT OR UPDATE ON public.certificacoes
FOR EACH ROW EXECUTE FUNCTION public.log_certificacao_status();

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS duracao_curso_valor INTEGER;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS duracao_curso_unidade TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS previsao_conclusao DATE;

CREATE INDEX IF NOT EXISTS idx_sales_previsao_conclusao ON public.sales(previsao_conclusao);
