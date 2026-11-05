CREATE TABLE public.acompanhamento_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  aluno_nome text NOT NULL,
  vendedor_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
  marco text NOT NULL,
  data_prevista_conclusao date,
  dias_restantes_no_contato integer,
  data_contato date NOT NULL DEFAULT CURRENT_DATE,
  canal text NOT NULL,
  resultado text NOT NULL,
  observacao text,
  proximo_contato_em date,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_acomp_contatos_sale ON public.acompanhamento_contatos(sale_id);
CREATE INDEX idx_acomp_contatos_aluno ON public.acompanhamento_contatos(aluno_id);
CREATE INDEX idx_acomp_contatos_vendedor ON public.acompanhamento_contatos(vendedor_id);
CREATE INDEX idx_acomp_contatos_data ON public.acompanhamento_contatos(data_contato);
CREATE INDEX idx_acomp_contatos_proximo ON public.acompanhamento_contatos(proximo_contato_em);

GRANT SELECT, INSERT ON public.acompanhamento_contatos TO authenticated;
GRANT ALL ON public.acompanhamento_contatos TO service_role;

ALTER TABLE public.acompanhamento_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem contatos de acompanhamento"
ON public.acompanhamento_contatos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados registram contatos"
ON public.acompanhamento_contatos FOR INSERT TO authenticated WITH CHECK (criado_por = auth.uid());

CREATE TABLE public.acompanhamento_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  marcos_dias integer[] NOT NULL DEFAULT '{30,15,7,3,0}',
  dias_reincidencia_sem_retorno integer NOT NULL DEFAULT 2,
  dias_para_escalonar integer NOT NULL DEFAULT 3,
  horario_corte_fila time NOT NULL DEFAULT '18:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.acompanhamento_config TO authenticated;
GRANT ALL ON public.acompanhamento_config TO service_role;

ALTER TABLE public.acompanhamento_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem config de acompanhamento"
ON public.acompanhamento_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins gerenciam config de acompanhamento"
ON public.acompanhamento_config FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.acompanhamento_config (singleton) VALUES (true);