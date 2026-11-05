-- ===== Permissões =====
CREATE OR REPLACE FUNCTION public.can_access_cobranca(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'admin') OR public.has_role(_uid,'financeiro') OR public.has_role(_uid,'gerente');
$$;
CREATE OR REPLACE FUNCTION public.can_view_cobranca_historico_geral(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'admin') OR public.has_role(_uid,'gerente');
$$;
REVOKE EXECUTE ON FUNCTION public.can_access_cobranca(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_cobranca_historico_geral(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_cobranca(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_cobranca_historico_geral(uuid) TO authenticated;

-- ===== Régua configurável =====
CREATE TABLE public.cobranca_regua_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  offset_dias integer NOT NULL UNIQUE,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobranca_regua_etapas TO authenticated;
GRANT ALL ON public.cobranca_regua_etapas TO service_role;
ALTER TABLE public.cobranca_regua_etapas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Regua view" ON public.cobranca_regua_etapas FOR SELECT TO authenticated USING (public.can_access_cobranca(auth.uid()));
CREATE POLICY "Regua manage" ON public.cobranca_regua_etapas FOR ALL TO authenticated
  USING (public.can_view_cobranca_historico_geral(auth.uid())) WITH CHECK (public.can_view_cobranca_historico_geral(auth.uid()));
INSERT INTO public.cobranca_regua_etapas (codigo, offset_dias, descricao) VALUES
 ('D-3',-3,'Lembrete antes do vencimento'),('D0',0,'Dia do vencimento'),('D+1',1,'1 dia de atraso'),
 ('D+3',3,'3 dias de atraso'),('D+5',5,'5 dias de atraso'),('D+7',7,'7 dias de atraso'),
 ('D+10',10,'10 dias de atraso'),('D+15',15,'15 dias de atraso'),('D+20',20,'20 dias de atraso'),('D+30',30,'30 dias de atraso');

-- ===== Processo de cobrança (aluno + venda) =====
CREATE TABLE public.cobrancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  aluno_nome text NOT NULL,
  responsavel_id uuid,
  situacao text NOT NULL DEFAULT 'ativa' CHECK (situacao IN ('ativa','encerrada')),
  origem text NOT NULL DEFAULT 'automatica' CHECK (origem IN ('automatica','manual')),
  parcela_referencia_id uuid REFERENCES public.installments(id) ON DELETE SET NULL,
  etapa_atual_id uuid REFERENCES public.cobranca_regua_etapas(id) ON DELETE SET NULL,
  proxima_acao_em date,
  proxima_acao_tipo text,
  ultima_acao_em timestamptz,
  ultima_acao_descricao text,
  motivo_encerramento text,
  encerrada_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_cobrancas_venda_ativa ON public.cobrancas(sale_id) WHERE situacao = 'ativa';
CREATE INDEX idx_cobrancas_proxima ON public.cobrancas(proxima_acao_em) WHERE situacao = 'ativa';
CREATE INDEX idx_cobrancas_student ON public.cobrancas(student_id);
GRANT SELECT, INSERT, UPDATE ON public.cobrancas TO authenticated;
GRANT ALL ON public.cobrancas TO service_role;
ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cobrancas view" ON public.cobrancas FOR SELECT TO authenticated USING (public.can_access_cobranca(auth.uid()));
CREATE POLICY "Cobrancas insert" ON public.cobrancas FOR INSERT TO authenticated WITH CHECK (public.can_access_cobranca(auth.uid()));
CREATE POLICY "Cobrancas update" ON public.cobrancas FOR UPDATE TO authenticated USING (public.can_access_cobranca(auth.uid()));

-- ===== Promessas =====
CREATE TABLE public.cobranca_promessas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id uuid NOT NULL REFERENCES public.cobrancas(id) ON DELETE RESTRICT,
  data_prometida date NOT NULL,
  valor_prometido numeric,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','cumprida','nao_cumprida','prorrogada','cancelada')),
  promessa_anterior_id uuid REFERENCES public.cobranca_promessas(id),
  observacao text,
  user_id uuid NOT NULL,
  resolvida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cob_promessas_cobranca ON public.cobranca_promessas(cobranca_id);
CREATE UNIQUE INDEX uq_cob_promessa_ativa ON public.cobranca_promessas(cobranca_id) WHERE status = 'ativa';

-- ===== Renegociações =====
CREATE TABLE public.cobranca_renegociacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id uuid NOT NULL REFERENCES public.cobrancas(id) ON DELETE RESTRICT,
  inicio date NOT NULL,
  suspensa_ate date,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','concluida','quebrada','expirada','cancelada')),
  observacao text,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cob_reneg_cobranca ON public.cobranca_renegociacoes(cobranca_id);

-- ===== Agendamentos =====
CREATE TABLE public.cobranca_agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id uuid NOT NULL REFERENCES public.cobrancas(id) ON DELETE RESTRICT,
  data date NOT NULL,
  tipo text NOT NULL,
  etapa_id uuid REFERENCES public.cobranca_regua_etapas(id),
  parcela_referencia_id uuid REFERENCES public.installments(id) ON DELETE SET NULL,
  origem text NOT NULL DEFAULT 'automatica' CHECK (origem IN ('automatica','manual')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','realizado','suspenso','cancelado')),
  motivo text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cob_agend_cobranca ON public.cobranca_agendamentos(cobranca_id, status);

-- ===== Ações especiais =====
CREATE TABLE public.cobranca_acoes_especiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id uuid NOT NULL REFERENCES public.cobrancas(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('inativacao','aviso_negativacao','negativacao')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','confirmada','suspensa','cancelada')),
  observacao text,
  solicitado_por uuid,
  confirmado_por uuid,
  confirmado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cob_acoes_cobranca ON public.cobranca_acoes_especiais(cobranca_id);

-- ===== Log (imutável) =====
CREATE TABLE public.cobranca_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id uuid NOT NULL REFERENCES public.cobrancas(id) ON DELETE RESTRICT,
  tipo text NOT NULL,
  descricao text,
  dados jsonb,
  automatico boolean NOT NULL DEFAULT false,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cob_eventos_cobranca ON public.cobranca_eventos(cobranca_id, created_at DESC);

-- grants + RLS nas tabelas filhas
GRANT SELECT, INSERT, UPDATE ON public.cobranca_promessas, public.cobranca_renegociacoes, public.cobranca_agendamentos, public.cobranca_acoes_especiais TO authenticated;
GRANT SELECT, INSERT ON public.cobranca_eventos TO authenticated;
GRANT ALL ON public.cobranca_promessas, public.cobranca_renegociacoes, public.cobranca_agendamentos, public.cobranca_acoes_especiais, public.cobranca_eventos TO service_role;
ALTER TABLE public.cobranca_promessas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_renegociacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_acoes_especiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobranca_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Promessas view" ON public.cobranca_promessas FOR SELECT TO authenticated USING (public.can_access_cobranca(auth.uid()));
CREATE POLICY "Promessas insert" ON public.cobranca_promessas FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_access_cobranca(auth.uid()));
CREATE POLICY "Promessas update" ON public.cobranca_promessas FOR UPDATE TO authenticated USING (public.can_access_cobranca(auth.uid()));
CREATE POLICY "Reneg view" ON public.cobranca_renegociacoes FOR SELECT TO authenticated USING (public.can_access_cobranca(auth.uid()));
CREATE POLICY "Reneg insert" ON public.cobranca_renegociacoes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_access_cobranca(auth.uid()));
CREATE POLICY "Reneg update" ON public.cobranca_renegociacoes FOR UPDATE TO authenticated USING (public.can_access_cobranca(auth.uid()));
CREATE POLICY "Agend view" ON public.cobranca_agendamentos FOR SELECT TO authenticated USING (public.can_access_cobranca(auth.uid()));
CREATE POLICY "Agend insert" ON public.cobranca_agendamentos FOR INSERT TO authenticated WITH CHECK (public.can_access_cobranca(auth.uid()));
CREATE POLICY "Agend update" ON public.cobranca_agendamentos FOR UPDATE TO authenticated USING (public.can_access_cobranca(auth.uid()));
CREATE POLICY "Acoes view" ON public.cobranca_acoes_especiais FOR SELECT TO authenticated USING (public.can_access_cobranca(auth.uid()));
CREATE POLICY "Acoes insert" ON public.cobranca_acoes_especiais FOR INSERT TO authenticated WITH CHECK (public.can_access_cobranca(auth.uid()));
CREATE POLICY "Acoes update" ON public.cobranca_acoes_especiais FOR UPDATE TO authenticated USING (public.can_access_cobranca(auth.uid()));
CREATE POLICY "Eventos view" ON public.cobranca_eventos FOR SELECT TO authenticated USING (public.can_access_cobranca(auth.uid()));
CREATE POLICY "Eventos insert" ON public.cobranca_eventos FOR INSERT TO authenticated WITH CHECK (public.can_access_cobranca(auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()));

-- ===== Interações: reaproveita collection_attempts =====
ALTER TABLE public.collection_attempts
  ADD COLUMN IF NOT EXISTS cobranca_id uuid REFERENCES public.cobrancas(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS etapa_id uuid REFERENCES public.cobranca_regua_etapas(id),
  ADD COLUMN IF NOT EXISTS tipo_interacao text NOT NULL DEFAULT 'cobranca';
ALTER TABLE public.collection_attempts DROP CONSTRAINT IF EXISTS collection_attempts_method_check;
ALTER TABLE public.collection_attempts ADD CONSTRAINT collection_attempts_method_check
  CHECK (method IN ('whatsapp','email','phone','sms','presencial','outro','sistema'));
ALTER TABLE public.collection_attempts ADD CONSTRAINT collection_attempts_tipo_interacao_check
  CHECK (tipo_interacao IN ('cobranca','retorno','observacao'));
CREATE INDEX IF NOT EXISTS idx_collection_attempts_cobranca ON public.collection_attempts(cobranca_id, etapa_id);

-- updated_at triggers
CREATE TRIGGER trg_cobrancas_updated_at BEFORE UPDATE ON public.cobrancas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cob_regua_updated_at BEFORE UPDATE ON public.cobranca_regua_etapas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cob_reneg_updated_at BEFORE UPDATE ON public.cobranca_renegociacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cob_agend_updated_at BEFORE UPDATE ON public.cobranca_agendamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cob_acoes_updated_at BEFORE UPDATE ON public.cobranca_acoes_especiais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- auditoria geral
CREATE TRIGGER trg_audit_cobrancas AFTER INSERT OR UPDATE OR DELETE ON public.cobrancas FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER trg_audit_cob_promessas AFTER INSERT OR UPDATE OR DELETE ON public.cobranca_promessas FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER trg_audit_cob_reneg AFTER INSERT OR UPDATE OR DELETE ON public.cobranca_renegociacoes FOR EACH ROW EXECUTE FUNCTION public.log_system_change();
CREATE TRIGGER trg_audit_cob_acoes AFTER INSERT OR UPDATE OR DELETE ON public.cobranca_acoes_especiais FOR EACH ROW EXECUTE FUNCTION public.log_system_change();

-- ===== Funções auxiliares =====
CREATE OR REPLACE FUNCTION public.cobranca_hoje() RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date;
$$;

CREATE OR REPLACE FUNCTION public.cobranca_log(_cobranca uuid, _tipo text, _descricao text, _dados jsonb DEFAULT NULL, _auto boolean DEFAULT false)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.cobranca_eventos (cobranca_id, tipo, descricao, dados, automatico, user_id)
  VALUES (_cobranca, _tipo, _descricao, _dados, _auto, CASE WHEN _auto THEN NULL ELSE auth.uid() END);
$$;

-- Recalcula parcela de referência, etapa e próxima ação de uma cobrança
CREATE OR REPLACE FUNCTION public.cobranca_recalcular_interno(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.cobrancas%ROWTYPE;
  v_hoje date := public.cobranca_hoje();
  v_janela integer;
  v_ref record;
  v_prom record;
  v_ren record;
  v_man record;
  v_etapa record;
  v_prox_etapa record;
  v_done boolean;
  v_prox date; v_tipo text; v_etapa_id uuid; v_agend_etapa uuid;
BEGIN
  SELECT * INTO c FROM public.cobrancas WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR c.situacao <> 'ativa' THEN RETURN; END IF;

  SELECT COALESCE(-MIN(offset_dias),0) INTO v_janela FROM public.cobranca_regua_etapas WHERE ativo;
  IF v_janela < 0 THEN v_janela := 0; END IF;

  SELECT id, due_date INTO v_ref FROM public.installments
   WHERE sale_id = c.sale_id AND status IN ('pending','due_today','overdue')
     AND due_date <= v_hoje + v_janela
   ORDER BY due_date, installment_number LIMIT 1;

  IF v_ref.id IS NULL THEN
    UPDATE public.cobrancas SET situacao='encerrada', encerrada_em=now(), motivo_encerramento='pagamento',
      proxima_acao_em=NULL, proxima_acao_tipo=NULL, ultima_acao_em=now(), ultima_acao_descricao='Encerrada: sem parcelas em aberto'
     WHERE id=_id;
    UPDATE public.cobranca_agendamentos SET status='cancelado', motivo='Cobrança encerrada' WHERE cobranca_id=_id AND status='pendente';
    UPDATE public.cobranca_promessas SET status='cumprida', resolvida_em=now() WHERE cobranca_id=_id AND status='ativa';
    PERFORM public.cobranca_log(_id,'pagamento','Parcelas em aberto quitadas',NULL,true);
    PERFORM public.cobranca_log(_id,'encerramento','Cobrança encerrada automaticamente',NULL,true);
    RETURN;
  END IF;

  IF c.parcela_referencia_id IS DISTINCT FROM v_ref.id THEN
    IF c.parcela_referencia_id IS NOT NULL THEN
      PERFORM public.cobranca_log(_id,'mudanca_automatica','Parcela de referência alterada',
        jsonb_build_object('anterior',c.parcela_referencia_id,'nova',v_ref.id),true);
    END IF;
    c.parcela_referencia_id := v_ref.id;
  END IF;

  -- Promessa
  SELECT * INTO v_prom FROM public.cobranca_promessas WHERE cobranca_id=_id AND status='ativa' LIMIT 1;
  IF v_prom.id IS NOT NULL AND v_prom.data_prometida < v_hoje THEN
    UPDATE public.cobranca_promessas SET status='nao_cumprida', resolvida_em=now() WHERE id=v_prom.id;
    PERFORM public.cobranca_log(_id,'promessa_nao_cumprida','Promessa de '||to_char(v_prom.data_prometida,'DD/MM/YYYY')||' não cumprida',NULL,true);
    PERFORM public.cobranca_log(_id,'retomada_regua','Régua retomada após promessa não cumprida',NULL,true);
    v_prom := NULL;
  END IF;

  -- Renegociação
  SELECT * INTO v_ren FROM public.cobranca_renegociacoes WHERE cobranca_id=_id AND status='ativa' ORDER BY created_at DESC LIMIT 1;
  IF v_ren.id IS NOT NULL AND v_ren.suspensa_ate IS NOT NULL AND v_ren.suspensa_ate < v_hoje THEN
    UPDATE public.cobranca_renegociacoes SET status='expirada' WHERE id=v_ren.id;
    PERFORM public.cobranca_log(_id,'retomada_regua','Régua retomada após fim da suspensão da renegociação',NULL,true);
    v_ren := NULL;
  END IF;

  -- Etapa atual da régua (baseada na parcela de referência)
  SELECT * INTO v_etapa FROM public.cobranca_regua_etapas
   WHERE ativo AND v_ref.due_date + offset_dias <= v_hoje ORDER BY offset_dias DESC LIMIT 1;
  v_etapa_id := v_etapa.id;

  SELECT * INTO v_man FROM public.cobranca_agendamentos
   WHERE cobranca_id=_id AND status='pendente' AND origem='manual' ORDER BY data LIMIT 1;

  IF v_prom.id IS NOT NULL THEN
    v_prox := v_prom.data_prometida; v_tipo := 'promessa';
  ELSIF v_ren.id IS NOT NULL THEN
    v_prox := v_ren.suspensa_ate; v_tipo := CASE WHEN v_ren.suspensa_ate IS NULL THEN NULL ELSE 'renegociacao' END;
  ELSIF v_man.id IS NOT NULL THEN
    v_prox := v_man.data; v_tipo := 'manual';
  ELSE
    v_done := false;
    IF v_etapa.id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM public.collection_attempts
        WHERE cobranca_id=_id AND etapa_id=v_etapa.id AND installment_id=v_ref.id AND tipo_interacao='cobranca') INTO v_done;
    END IF;
    IF v_etapa.id IS NOT NULL AND NOT v_done THEN
      v_prox := v_ref.due_date + v_etapa.offset_dias; v_tipo := 'regua'; v_agend_etapa := v_etapa.id;
    ELSE
      SELECT * INTO v_prox_etapa FROM public.cobranca_regua_etapas
       WHERE ativo AND v_ref.due_date + offset_dias > v_hoje ORDER BY offset_dias LIMIT 1;
      IF v_prox_etapa.id IS NOT NULL THEN
        v_prox := v_ref.due_date + v_prox_etapa.offset_dias; v_tipo := 'regua'; v_agend_etapa := v_prox_etapa.id;
      ELSE
        v_prox := NULL; v_tipo := NULL;
      END IF;
    END IF;
  END IF;

  -- Mantém agendamentos automáticos coerentes
  UPDATE public.cobranca_agendamentos SET status = CASE WHEN v_tipo IN ('promessa','renegociacao') THEN 'suspenso' ELSE 'cancelado' END,
         motivo = CASE WHEN v_tipo IN ('promessa','renegociacao') THEN 'Régua suspensa por '||v_tipo ELSE 'Recalculado' END
   WHERE cobranca_id=_id AND origem='automatica' AND status='pendente'
     AND (v_agend_etapa IS NULL OR etapa_id IS DISTINCT FROM v_agend_etapa OR data IS DISTINCT FROM v_prox OR parcela_referencia_id IS DISTINCT FROM v_ref.id);
  IF v_agend_etapa IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cobranca_agendamentos
       WHERE cobranca_id=_id AND origem='automatica' AND status='pendente' AND etapa_id=v_agend_etapa AND parcela_referencia_id=v_ref.id) THEN
    INSERT INTO public.cobranca_agendamentos (cobranca_id, data, tipo, etapa_id, parcela_referencia_id, origem)
    VALUES (_id, v_prox, 'regua', v_agend_etapa, v_ref.id, 'automatica');
    PERFORM public.cobranca_log(_id,'etapa_criada','Etapa '||(SELECT codigo FROM public.cobranca_regua_etapas WHERE id=v_agend_etapa)||' agendada para '||to_char(v_prox,'DD/MM/YYYY'),NULL,true);
  END IF;

  UPDATE public.cobrancas SET parcela_referencia_id=c.parcela_referencia_id, etapa_atual_id=v_etapa_id,
         proxima_acao_em=v_prox, proxima_acao_tipo=v_tipo
   WHERE id=_id AND (parcela_referencia_id IS DISTINCT FROM c.parcela_referencia_id OR etapa_atual_id IS DISTINCT FROM v_etapa_id
         OR proxima_acao_em IS DISTINCT FROM v_prox OR proxima_acao_tipo IS DISTINCT FROM v_tipo);
END;
$$;

-- Cria processos para vendas com parcelas em aberto e recalcula todos os ativos
CREATE OR REPLACE FUNCTION public.cobranca_sincronizar()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hoje date := public.cobranca_hoje();
  v_janela integer;
  r record; v_id uuid; v_n integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_access_cobranca(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501';
  END IF;
  SELECT GREATEST(COALESCE(-MIN(offset_dias),0),0) INTO v_janela FROM public.cobranca_regua_etapas WHERE ativo;

  FOR r IN
    SELECT DISTINCT s.id AS sale_id, s.student_name
    FROM public.sales s JOIN public.installments i ON i.sale_id = s.id
    WHERE s.status = 'ativa' AND i.status IN ('pending','due_today','overdue') AND i.due_date <= v_hoje + v_janela
      AND NOT EXISTS (SELECT 1 FROM public.cobrancas c WHERE c.sale_id = s.id AND c.situacao='ativa')
  LOOP
    INSERT INTO public.cobrancas (sale_id, student_id, aluno_nome, origem, created_by)
    VALUES (r.sale_id,
      (SELECT st.id FROM public.students st WHERE lower(trim(st.full_name)) = lower(trim(r.student_name)) ORDER BY st.created_at LIMIT 1),
      r.student_name, 'automatica', auth.uid())
    RETURNING id INTO v_id;
    PERFORM public.cobranca_log(v_id,'cobranca_criada','Cobrança criada automaticamente',NULL,true);
    v_n := v_n + 1;
  END LOOP;

  FOR r IN SELECT id FROM public.cobrancas WHERE situacao='ativa' LOOP
    PERFORM public.cobranca_recalcular_interno(r.id);
  END LOOP;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.cobranca_recalcular(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  PERFORM public.cobranca_recalcular_interno(_id);
END; $$;

CREATE OR REPLACE FUNCTION public.cobranca_registrar_interacao(_cobranca uuid, _tipo text, _canal text, _resultado text, _observacao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.cobrancas%ROWTYPE; v_id uuid; v_etapa uuid;
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.cobrancas WHERE id=_cobranca;
  IF NOT FOUND OR c.situacao <> 'ativa' THEN RAISE EXCEPTION 'Cobrança não está ativa'; END IF;
  IF c.parcela_referencia_id IS NULL THEN RAISE EXCEPTION 'Cobrança sem parcela de referência'; END IF;
  -- etapa cumprida = etapa do agendamento automático pendente vencido/hoje, senão etapa atual
  SELECT etapa_id INTO v_etapa FROM public.cobranca_agendamentos
   WHERE cobranca_id=_cobranca AND origem='automatica' AND status='pendente' AND data <= public.cobranca_hoje() ORDER BY data LIMIT 1;
  v_etapa := COALESCE(v_etapa, c.etapa_atual_id);

  INSERT INTO public.collection_attempts (user_id, installment_id, sale_id, cobranca_id, etapa_id, tipo_interacao, date, method, resultado, notes)
  VALUES (auth.uid(), c.parcela_referencia_id, c.sale_id, _cobranca, CASE WHEN _tipo='cobranca' THEN v_etapa END, _tipo, now(), _canal, COALESCE(_resultado,'sem_resposta'), _observacao)
  RETURNING id INTO v_id;

  IF _tipo = 'cobranca' THEN
    UPDATE public.cobranca_agendamentos SET status='realizado', user_id=auth.uid()
     WHERE cobranca_id=_cobranca AND status='pendente' AND data <= public.cobranca_hoje()
       AND (origem='manual' OR etapa_id = v_etapa);
  END IF;
  UPDATE public.cobrancas SET ultima_acao_em=now(),
    ultima_acao_descricao = CASE _tipo WHEN 'cobranca' THEN 'Cobrança realizada' WHEN 'retorno' THEN 'Retorno do aluno' ELSE 'Observação' END || ' ('||_canal||')'
   WHERE id=_cobranca;
  PERFORM public.cobranca_log(_cobranca, CASE _tipo WHEN 'cobranca' THEN 'cobranca_realizada' WHEN 'retorno' THEN 'retorno_recebido' ELSE 'observacao' END,
    _observacao, jsonb_build_object('canal',_canal,'resultado',_resultado,'etapa_id',v_etapa,'interacao_id',v_id));
  PERFORM public.cobranca_recalcular_interno(_cobranca);
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cobranca_registrar_promessa(_cobranca uuid, _data date, _valor numeric DEFAULT NULL, _observacao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old record; v_id uuid;
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  IF _data < public.cobranca_hoje() THEN RAISE EXCEPTION 'Data da promessa não pode ser no passado'; END IF;
  SELECT * INTO v_old FROM public.cobranca_promessas WHERE cobranca_id=_cobranca AND status='ativa' LIMIT 1;
  IF v_old.id IS NOT NULL THEN
    UPDATE public.cobranca_promessas SET status='prorrogada', resolvida_em=now() WHERE id=v_old.id;
  END IF;
  INSERT INTO public.cobranca_promessas (cobranca_id, data_prometida, valor_prometido, observacao, user_id, promessa_anterior_id)
  VALUES (_cobranca, _data, _valor, _observacao, auth.uid(), v_old.id) RETURNING id INTO v_id;
  PERFORM public.cobranca_log(_cobranca, CASE WHEN v_old.id IS NULL THEN 'promessa_criada' ELSE 'promessa_prorrogada' END,
    'Promessa para '||to_char(_data,'DD/MM/YYYY'), jsonb_build_object('valor',_valor,'promessa_id',v_id,'anterior',v_old.id));
  UPDATE public.cobrancas SET ultima_acao_em=now(), ultima_acao_descricao='Promessa para '||to_char(_data,'DD/MM/YYYY') WHERE id=_cobranca;
  PERFORM public.cobranca_recalcular_interno(_cobranca);
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cobranca_registrar_renegociacao(_cobranca uuid, _inicio date, _suspensa_ate date, _observacao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  UPDATE public.cobranca_renegociacoes SET status='cancelada' WHERE cobranca_id=_cobranca AND status='ativa';
  INSERT INTO public.cobranca_renegociacoes (cobranca_id, inicio, suspensa_ate, observacao, user_id)
  VALUES (_cobranca, _inicio, _suspensa_ate, _observacao, auth.uid()) RETURNING id INTO v_id;
  PERFORM public.cobranca_log(_cobranca,'renegociacao','Renegociação registrada', jsonb_build_object('inicio',_inicio,'suspensa_ate',_suspensa_ate,'id',v_id));
  PERFORM public.cobranca_recalcular_interno(_cobranca);
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cobranca_agendar_manual(_cobranca uuid, _data date, _tipo text DEFAULT 'contato', _motivo text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  -- Durante a régua automática o operador não escolhe a data: só permitido sem etapas futuras pendentes
  IF EXISTS (SELECT 1 FROM public.cobrancas WHERE id=_cobranca AND proxima_acao_tipo='regua') THEN
    RAISE EXCEPTION 'Régua automática em andamento: agendamento manual não permitido';
  END IF;
  INSERT INTO public.cobranca_agendamentos (cobranca_id, data, tipo, origem, motivo, user_id)
  VALUES (_cobranca, _data, _tipo, 'manual', _motivo, auth.uid()) RETURNING id INTO v_id;
  PERFORM public.cobranca_log(_cobranca,'agendamento_manual','Agendado para '||to_char(_data,'DD/MM/YYYY'), jsonb_build_object('id',v_id,'tipo',_tipo));
  PERFORM public.cobranca_recalcular_interno(_cobranca);
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cobranca_cancelar_agendamento(_agendamento uuid, _motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cob uuid;
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  UPDATE public.cobranca_agendamentos SET status='cancelado', motivo=_motivo, user_id=auth.uid()
   WHERE id=_agendamento AND status='pendente' RETURNING cobranca_id INTO v_cob;
  IF v_cob IS NULL THEN RAISE EXCEPTION 'Agendamento não encontrado ou já resolvido'; END IF;
  PERFORM public.cobranca_log(v_cob,'cancelamento_agendamento',_motivo, jsonb_build_object('id',_agendamento));
  PERFORM public.cobranca_recalcular_interno(v_cob);
END; $$;

CREATE OR REPLACE FUNCTION public.cobranca_acao_especial(_cobranca uuid, _tipo text, _status text, _observacao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  SELECT id INTO v_id FROM public.cobranca_acoes_especiais WHERE cobranca_id=_cobranca AND tipo=_tipo AND status IN ('pendente','suspensa') ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.cobranca_acoes_especiais (cobranca_id, tipo, status, observacao, solicitado_por,
      confirmado_por, confirmado_em)
    VALUES (_cobranca, _tipo, _status, _observacao, auth.uid(),
      CASE WHEN _status='confirmada' THEN auth.uid() END, CASE WHEN _status='confirmada' THEN now() END)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.cobranca_acoes_especiais SET status=_status, observacao=COALESCE(_observacao,observacao),
      confirmado_por = CASE WHEN _status='confirmada' THEN auth.uid() ELSE confirmado_por END,
      confirmado_em = CASE WHEN _status='confirmada' THEN now() ELSE confirmado_em END
     WHERE id=v_id;
  END IF;
  PERFORM public.cobranca_log(_cobranca, CASE WHEN _tipo='inativacao' THEN 'inativacao' ELSE 'negativacao' END,
    _tipo||' → '||_status||COALESCE(': '||_observacao,''), jsonb_build_object('acao_id',v_id,'tipo',_tipo,'status',_status));
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cobranca_encerrar(_cobranca uuid, _motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  UPDATE public.cobrancas SET situacao='encerrada', encerrada_em=now(), motivo_encerramento=_motivo,
    proxima_acao_em=NULL, proxima_acao_tipo=NULL, ultima_acao_em=now(), ultima_acao_descricao='Encerrada: '||_motivo
   WHERE id=_cobranca AND situacao='ativa';
  UPDATE public.cobranca_agendamentos SET status='cancelado', motivo='Cobrança encerrada' WHERE cobranca_id=_cobranca AND status='pendente';
  PERFORM public.cobranca_log(_cobranca,'encerramento',_motivo);
END; $$;

CREATE OR REPLACE FUNCTION public.cobranca_reabrir(_cobranca uuid, _motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sale uuid;
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  SELECT sale_id INTO v_sale FROM public.cobrancas WHERE id=_cobranca AND situacao='encerrada';
  IF v_sale IS NULL THEN RAISE EXCEPTION 'Cobrança não está encerrada'; END IF;
  IF EXISTS (SELECT 1 FROM public.cobrancas WHERE sale_id=v_sale AND situacao='ativa') THEN
    RAISE EXCEPTION 'Já existe uma cobrança ativa para esta venda';
  END IF;
  UPDATE public.cobrancas SET situacao='ativa', encerrada_em=NULL, motivo_encerramento=NULL WHERE id=_cobranca;
  PERFORM public.cobranca_log(_cobranca,'reabertura',_motivo);
  PERFORM public.cobranca_recalcular_interno(_cobranca);
END; $$;

-- Painel com situação operacional (HOJE / ATRASADOS / AGENDADOS / SEM AGENDAMENTO)
CREATE OR REPLACE VIEW public.cobrancas_painel WITH (security_invoker = true) AS
SELECT c.*,
  CASE
    WHEN c.situacao <> 'ativa' THEN 'encerrada'
    WHEN c.proxima_acao_em IS NULL THEN 'sem_agendamento'
    WHEN c.proxima_acao_em = public.cobranca_hoje() THEN 'hoje'
    WHEN c.proxima_acao_em < public.cobranca_hoje() THEN 'atrasados'
    ELSE 'agendados'
  END AS situacao_operacional,
  e.codigo AS etapa_codigo,
  i.due_date AS parcela_vencimento,
  i.installment_number AS parcela_numero,
  i.value AS parcela_valor,
  (SELECT COUNT(*) FROM public.installments x WHERE x.sale_id=c.sale_id AND x.status IN ('pending','due_today','overdue') AND x.due_date < public.cobranca_hoje()) AS parcelas_vencidas,
  (SELECT COALESCE(SUM(x.value),0) FROM public.installments x WHERE x.sale_id=c.sale_id AND x.status IN ('pending','due_today','overdue') AND x.due_date < public.cobranca_hoje()) AS valor_vencido
FROM public.cobrancas c
LEFT JOIN public.cobranca_regua_etapas e ON e.id = c.etapa_atual_id
LEFT JOIN public.installments i ON i.id = c.parcela_referencia_id;
GRANT SELECT ON public.cobrancas_painel TO authenticated;
REVOKE ALL ON public.cobrancas_painel FROM anon;

-- Execução só para autenticados (checagem de cargo dentro de cada função)
REVOKE EXECUTE ON FUNCTION public.cobranca_log(uuid,text,text,jsonb,boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cobranca_recalcular_interno(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cobranca_sincronizar() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cobranca_recalcular(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cobranca_registrar_interacao(uuid,text,text,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cobranca_registrar_promessa(uuid,date,numeric,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cobranca_registrar_renegociacao(uuid,date,date,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cobranca_agendar_manual(uuid,date,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cobranca_cancelar_agendamento(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cobranca_acao_especial(uuid,text,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cobranca_encerrar(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cobranca_reabrir(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cobranca_sincronizar(), public.cobranca_recalcular(uuid),
  public.cobranca_registrar_interacao(uuid,text,text,text,text), public.cobranca_registrar_promessa(uuid,date,numeric,text),
  public.cobranca_registrar_renegociacao(uuid,date,date,text), public.cobranca_agendar_manual(uuid,date,text,text),
  public.cobranca_cancelar_agendamento(uuid,text), public.cobranca_acao_especial(uuid,text,text,text),
  public.cobranca_encerrar(uuid,text), public.cobranca_reabrir(uuid,text) TO authenticated;