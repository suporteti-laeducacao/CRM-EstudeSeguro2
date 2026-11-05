-- 2. Promessa substituída por renegociação
ALTER TABLE public.cobranca_promessas DROP CONSTRAINT IF EXISTS cobranca_promessas_status_check;
ALTER TABLE public.cobranca_promessas ADD CONSTRAINT cobranca_promessas_status_check
  CHECK (status IN ('ativa','cumprida','nao_cumprida','prorrogada','cancelada','substituida_renegociacao'));
ALTER TABLE public.cobranca_promessas ADD COLUMN IF NOT EXISTS substituida_por_renegociacao_id uuid REFERENCES public.cobranca_renegociacoes(id);

-- 4. Estado "aguardando próxima parcela" (monitoramento)
ALTER TABLE public.cobrancas DROP CONSTRAINT IF EXISTS cobrancas_situacao_check;
ALTER TABLE public.cobrancas ADD CONSTRAINT cobrancas_situacao_check CHECK (situacao IN ('ativa','encerrada','monitoramento'));
DROP INDEX IF EXISTS public.uq_cobrancas_venda_ativa;
CREATE UNIQUE INDEX uq_cobrancas_venda_ativa ON public.cobrancas (sale_id) WHERE situacao IN ('ativa','monitoramento');

CREATE OR REPLACE FUNCTION public.cobranca_registrar_renegociacao(_cobranca uuid, _inicio date, _suspensa_ate date, _observacao text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_old uuid; v_p record;
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  IF _suspensa_ate IS NOT NULL AND _suspensa_ate < _inicio THEN RAISE EXCEPTION 'Data final anterior ao início'; END IF;
  SELECT id INTO v_old FROM public.cobranca_renegociacoes WHERE cobranca_id=_cobranca AND status='ativa' ORDER BY created_at DESC LIMIT 1;
  UPDATE public.cobranca_renegociacoes SET status='cancelada' WHERE cobranca_id=_cobranca AND status='ativa';
  INSERT INTO public.cobranca_renegociacoes (cobranca_id, inicio, suspensa_ate, observacao, user_id)
  VALUES (_cobranca, _inicio, _suspensa_ate, _observacao, auth.uid()) RETURNING id INTO v_id;
  FOR v_p IN SELECT * FROM public.cobranca_promessas WHERE cobranca_id=_cobranca AND status='ativa' LOOP
    UPDATE public.cobranca_promessas SET status='substituida_renegociacao', resolvida_em=now(), substituida_por_renegociacao_id=v_id WHERE id=v_p.id;
    PERFORM public.cobranca_log(_cobranca,'promessa_substituida',
      'Promessa de pagamento substituída por renegociação (promessa feita em '||to_char(v_p.created_at AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY')
        ||', data prometida '||to_char(v_p.data_prometida,'DD/MM/YYYY')||')',
      jsonb_build_object('promessa_id',v_p.id,'promessa_criada_em',v_p.created_at,'data_prometida',v_p.data_prometida,
        'promessa_registrada_por',v_p.user_id,'substituida_em',now(),'renegociacao_registrada_por',auth.uid(),'renegociacao_id',v_id));
  END LOOP;
  PERFORM public.cobranca_log(_cobranca, CASE WHEN v_old IS NULL THEN 'renegociacao' ELSE 'renegociacao_prorrogada' END,
    CASE WHEN v_old IS NULL THEN 'Renegociação registrada' ELSE 'Renegociação prorrogada' END
      || COALESCE(' até '||to_char(_suspensa_ate,'DD/MM/YYYY'),''),
    jsonb_build_object('inicio',_inicio,'suspensa_ate',_suspensa_ate,'id',v_id,'anterior',v_old,'observacao',_observacao));
  UPDATE public.cobrancas SET ultima_acao_em=now(), ultima_acao_descricao='Renegociação'||COALESCE(' até '||to_char(_suspensa_ate,'DD/MM/YYYY'),'') WHERE id=_cobranca;
  PERFORM public.cobranca_recalcular_interno(_cobranca);
  RETURN v_id;
END; $function$;

-- 1. Execução de etapa (inclusive atrasada)
CREATE OR REPLACE FUNCTION public.cobranca_registrar_interacao(_cobranca uuid, _tipo text, _canal text, _resultado text, _observacao text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c public.cobrancas%ROWTYPE; v_id uuid; v_etapa uuid; v_desc text; v_canal_l text; v_ag record; v_hoje date := public.cobranca_hoje();
  v_off integer; v_venc date; v_s record; v_atraso integer := 0;
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.cobrancas WHERE id=_cobranca;
  IF NOT FOUND OR c.situacao <> 'ativa' THEN RAISE EXCEPTION 'Cobrança não está ativa'; END IF;
  IF c.parcela_referencia_id IS NULL THEN RAISE EXCEPTION 'Cobrança sem parcela de referência'; END IF;
  SELECT * INTO v_ag FROM public.cobranca_agendamentos
   WHERE cobranca_id=_cobranca AND origem='automatica' AND status='pendente' AND data <= v_hoje ORDER BY data LIMIT 1;
  v_etapa := COALESCE(v_ag.etapa_id, c.etapa_atual_id);
  IF _tipo='cobranca' AND v_ag.id IS NOT NULL THEN v_atraso := v_hoje - v_ag.data; END IF;
  v_canal_l := CASE _canal WHEN 'whatsapp' THEN 'WhatsApp' WHEN 'phone' THEN 'Ligação' WHEN 'email' THEN 'E-mail' WHEN 'sms' THEN 'SMS' WHEN 'presencial' THEN 'Presencial' ELSE 'Outro' END;

  INSERT INTO public.collection_attempts (user_id, installment_id, sale_id, cobranca_id, etapa_id, tipo_interacao, date, method, resultado, notes)
  VALUES (auth.uid(), c.parcela_referencia_id, c.sale_id, _cobranca, CASE WHEN _tipo='cobranca' THEN v_etapa END, _tipo, now(), _canal, COALESCE(_resultado,'aguardando_retorno'), _observacao)
  RETURNING id INTO v_id;

  IF _tipo = 'cobranca' THEN
    UPDATE public.cobranca_agendamentos SET status='realizado', user_id=auth.uid()
     WHERE cobranca_id=_cobranca AND status='pendente' AND data <= v_hoje AND (origem='manual' OR etapa_id = v_etapa);
    -- etapas intermediárias que passaram durante o atraso deixam de ser aplicáveis
    IF v_etapa IS NOT NULL THEN
      SELECT offset_dias INTO v_off FROM public.cobranca_regua_etapas WHERE id=v_etapa;
      SELECT due_date INTO v_venc FROM public.installments WHERE id=c.parcela_referencia_id;
      FOR v_s IN SELECT id, codigo FROM public.cobranca_regua_etapas
        WHERE ativo AND offset_dias > v_off AND v_venc + offset_dias <= v_hoje ORDER BY offset_dias LOOP
        PERFORM public.cobranca_log(_cobranca,'etapa_nao_aplicavel',
          'Etapa '||v_s.codigo||' deixou de ser aplicável devido à execução tardia da etapa anterior.',
          jsonb_build_object('etapa_id',v_s.id,'parcela_id',c.parcela_referencia_id,'etapa_executada',v_etapa),true);
      END LOOP;
    END IF;
  END IF;

  v_desc := CASE
    WHEN _tipo='cobranca' AND _resultado='nao_atendeu' THEN 'Tentativa de ligação — não atendeu'
    WHEN _tipo='cobranca' THEN 'Cobrança realizada ('||v_canal_l||')'
    WHEN _tipo='retorno' THEN 'Retorno do aluno ('||v_canal_l||')'
    ELSE 'Observação' END;
  IF v_atraso > 0 THEN
    v_desc := v_desc || ' — etapa '||COALESCE((SELECT codigo FROM public.cobranca_regua_etapas WHERE id=v_etapa),'')
      ||' prevista para '||to_char(v_ag.data,'DD/MM/YYYY')||', executada com '||v_atraso||' dia(s) de atraso';
  END IF;
  UPDATE public.cobrancas SET ultima_acao_em=now(), ultima_acao_descricao=v_desc WHERE id=_cobranca;
  PERFORM public.cobranca_log(_cobranca, CASE _tipo WHEN 'cobranca' THEN 'cobranca_realizada' WHEN 'retorno' THEN 'retorno_recebido' ELSE 'observacao' END,
    v_desc || COALESCE(' — '||_observacao,''), jsonb_build_object('canal',_canal,'resultado',_resultado,'etapa_id',v_etapa,'interacao_id',v_id,
      'data_prevista',v_ag.data,'executada_em',v_hoje,'dias_atraso',v_atraso));
  PERFORM public.cobranca_recalcular_interno(_cobranca);
  RETURN v_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.cobranca_recalcular_interno(_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  c public.cobrancas%ROWTYPE;
  v_hoje date := public.cobranca_hoje();
  v_janela integer; v_ref record; v_prom record; v_ren record; v_man record; v_etapa record; v_prox_etapa record; v_s record; v_m record;
  v_prox date; v_tipo text; v_etapa_id uuid; v_agend_etapa uuid; v_ult timestamptz;
  v_susp_ini date; v_susp_fim date; v_susp_motivo text; v_max_off integer; v_aviso record; v_data date; v_med record;
  v_last_off integer; v_pend record; v_futuras boolean;
BEGIN
  SELECT * INTO c FROM public.cobrancas WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR c.situacao NOT IN ('ativa','monitoramento') THEN RETURN; END IF;
  SELECT COALESCE(-MIN(offset_dias),0), COALESCE(MAX(offset_dias),0) INTO v_janela, v_max_off FROM public.cobranca_regua_etapas WHERE ativo;
  IF v_janela < 0 THEN v_janela := 0; END IF;
  SELECT id, due_date INTO v_ref FROM public.installments
   WHERE sale_id = c.sale_id AND status IN ('pending','due_today','overdue') AND due_date <= v_hoje + v_janela
   ORDER BY due_date, installment_number LIMIT 1;
  IF v_ref.id IS NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.installments WHERE sale_id=c.sale_id AND status IN ('pending','due_today','overdue')) INTO v_futuras;
    IF c.situacao = 'monitoramento' THEN RETURN; END IF;
    UPDATE public.cobranca_agendamentos SET status='cancelado', motivo='Sem parcela em cobrança' WHERE cobranca_id=_id AND status='pendente';
    UPDATE public.cobranca_promessas SET status='cumprida', resolvida_em=now() WHERE cobranca_id=_id AND status='ativa';
    UPDATE public.cobranca_renegociacoes SET status='concluida' WHERE cobranca_id=_id AND status='ativa';
    UPDATE public.cobranca_acoes_especiais SET status='cancelada', observacao=COALESCE(observacao,'Parcelas quitadas') WHERE cobranca_id=_id AND status IN ('pendente','suspensa');
    PERFORM public.cobranca_log(_id,'pagamento','Parcelas em aberto quitadas',NULL,true);
    IF v_futuras THEN
      UPDATE public.cobrancas SET situacao='monitoramento', proxima_acao_em=NULL, proxima_acao_tipo=NULL, parcela_referencia_id=NULL, etapa_atual_id=NULL,
        ultima_acao_em=now(), ultima_acao_descricao='Aguardando próxima parcela' WHERE id=_id;
      PERFORM public.cobranca_log(_id,'monitoramento','Cobrança aguardando próxima parcela (monitoramento).',NULL,true);
    ELSE
      UPDATE public.cobrancas SET situacao='encerrada', encerrada_em=now(), motivo_encerramento='pagamento',
        proxima_acao_em=NULL, proxima_acao_tipo=NULL, ultima_acao_em=now(), ultima_acao_descricao='Encerrada: sem parcelas em aberto' WHERE id=_id;
      PERFORM public.cobranca_log(_id,'encerramento','Cobrança encerrada automaticamente',NULL,true);
    END IF;
    RETURN;
  END IF;
  IF c.situacao = 'monitoramento' THEN
    UPDATE public.cobrancas SET situacao='ativa' WHERE id=_id;
    c.situacao := 'ativa';
    PERFORM public.cobranca_log(_id,'reativacao_automatica','Próxima parcela entrou na régua — cobrança reativada.',
      jsonb_build_object('parcela_id',v_ref.id),true);
  END IF;
  IF c.parcela_referencia_id IS DISTINCT FROM v_ref.id THEN
    IF c.parcela_referencia_id IS NOT NULL THEN
      PERFORM public.cobranca_log(_id,'mudanca_automatica','Parcela de referência alterada',
        jsonb_build_object('anterior',c.parcela_referencia_id,'nova',v_ref.id),true);
    END IF;
    c.parcela_referencia_id := v_ref.id;
  END IF;
  SELECT * INTO v_prom FROM public.cobranca_promessas WHERE cobranca_id=_id AND status='ativa' ORDER BY created_at DESC LIMIT 1;
  SELECT * INTO v_ren FROM public.cobranca_renegociacoes WHERE cobranca_id=_id AND status='ativa' ORDER BY created_at DESC LIMIT 1;

  IF v_ren.id IS NULL THEN
    FOR v_m IN SELECT id, tipo FROM public.cobranca_acoes_especiais WHERE cobranca_id=_id AND status='suspensa' LOOP
      UPDATE public.cobranca_acoes_especiais SET status='pendente', data_prevista=v_hoje WHERE id=v_m.id;
      PERFORM public.cobranca_log(_id,'medida_retomada','Medida especial retomada após fim da renegociação ('||v_m.tipo||')',
        jsonb_build_object('acao_id',v_m.id),true);
    END LOOP;
  END IF;

  IF v_prom.id IS NOT NULL THEN
    v_susp_ini := v_prom.created_at::date; v_susp_fim := v_prom.data_prometida;
    v_susp_motivo := 'Etapa suspensa devido a promessa de pagamento ativa.';
  ELSIF v_ren.id IS NOT NULL THEN
    v_susp_ini := LEAST(v_ren.inicio, v_ren.created_at::date); v_susp_fim := COALESCE(v_ren.suspensa_ate, v_hoje);
    v_susp_motivo := 'Etapa suspensa devido a renegociação ativa.';
  END IF;
  IF v_susp_ini IS NOT NULL THEN
    FOR v_s IN SELECT id, codigo FROM public.cobranca_regua_etapas
      WHERE ativo AND v_ref.due_date + offset_dias >= v_susp_ini AND v_ref.due_date + offset_dias <= LEAST(v_susp_fim, v_hoje)
    LOOP
      IF NOT EXISTS (SELECT 1 FROM public.cobranca_eventos WHERE cobranca_id=_id AND tipo='etapa_suspensa'
            AND dados->>'etapa_id'=v_s.id::text AND dados->>'parcela_id'=v_ref.id::text) THEN
        PERFORM public.cobranca_log(_id,'etapa_suspensa',v_susp_motivo||' ('||v_s.codigo||')',
          jsonb_build_object('etapa_id',v_s.id,'parcela_id',v_ref.id),true);
      END IF;
    END LOOP;
  END IF;

  -- Última etapa resolvida (executada, suspensa ou não aplicável) para a parcela de referência
  SELECT MAX(e.offset_dias) INTO v_last_off FROM public.cobranca_regua_etapas e
   WHERE e.ativo AND (
     EXISTS (SELECT 1 FROM public.collection_attempts a WHERE a.cobranca_id=_id AND a.etapa_id=e.id AND a.installment_id=v_ref.id AND a.tipo_interacao='cobranca')
     OR EXISTS (SELECT 1 FROM public.cobranca_eventos ev WHERE ev.cobranca_id=_id AND ev.tipo IN ('etapa_suspensa','etapa_nao_aplicavel')
                AND ev.dados->>'etapa_id'=e.id::text AND ev.dados->>'parcela_id'=v_ref.id::text));

  -- Etapa pendente: permanece a mesma até ser executada (nunca pulada)
  SELECT a.data, e.* INTO v_pend FROM public.cobranca_agendamentos a JOIN public.cobranca_regua_etapas e ON e.id=a.etapa_id
   WHERE a.cobranca_id=_id AND a.origem='automatica' AND a.status='pendente' AND a.parcela_referencia_id=v_ref.id
     AND e.ativo AND (v_last_off IS NULL OR e.offset_dias > v_last_off)
   ORDER BY a.data LIMIT 1;
  IF v_pend.id IS NOT NULL THEN
    SELECT * INTO v_etapa FROM public.cobranca_regua_etapas WHERE id=v_pend.id;
  ELSIF v_last_off IS NULL THEN
    SELECT * INTO v_etapa FROM public.cobranca_regua_etapas
     WHERE ativo AND v_ref.due_date + offset_dias <= v_hoje ORDER BY offset_dias DESC LIMIT 1;
  ELSE
    SELECT * INTO v_etapa FROM public.cobranca_regua_etapas
     WHERE ativo AND offset_dias > v_last_off AND v_ref.due_date + offset_dias <= v_hoje ORDER BY offset_dias LIMIT 1;
  END IF;
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
    IF v_etapa.id IS NOT NULL THEN
      v_prox := COALESCE(v_pend.data, v_ref.due_date + v_etapa.offset_dias); v_tipo := 'regua'; v_agend_etapa := v_etapa.id;
      SELECT max(date) INTO v_ult FROM public.collection_attempts WHERE cobranca_id=_id AND tipo_interacao='cobranca';
      IF v_ult IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public.collection_attempts WHERE cobranca_id=_id AND tipo_interacao='retorno' AND date >= v_ult)
         AND NOT EXISTS (SELECT 1 FROM public.cobranca_eventos WHERE cobranca_id=_id AND tipo='sem_retorno'
               AND dados->>'etapa_id' = v_etapa.id::text AND dados->>'parcela_id' = v_ref.id::text) THEN
        PERFORM public.cobranca_log(_id,'sem_retorno','Cobrança anterior permaneceu sem retorno até a próxima etapa.',
          jsonb_build_object('etapa_id',v_etapa.id,'parcela_id',v_ref.id),true);
      END IF;
    ELSE
      SELECT * INTO v_prox_etapa FROM public.cobranca_regua_etapas
       WHERE ativo AND v_ref.due_date + offset_dias > v_hoje AND (v_last_off IS NULL OR offset_dias > v_last_off) ORDER BY offset_dias LIMIT 1;
      IF v_prox_etapa.id IS NOT NULL THEN
        v_prox := v_ref.due_date + v_prox_etapa.offset_dias; v_tipo := 'regua'; v_agend_etapa := v_prox_etapa.id;
      ELSE
        IF v_hoje > v_ref.due_date + v_max_off THEN
          FOR v_med IN SELECT tipo, offset_dias FROM public.cobranca_medidas_config WHERE ativo ORDER BY offset_dias LOOP
            CONTINUE WHEN v_hoje < v_ref.due_date + v_med.offset_dias;
            CONTINUE WHEN EXISTS (SELECT 1 FROM public.cobranca_acoes_especiais WHERE cobranca_id=_id AND tipo=v_med.tipo
                                   AND (status IN ('pendente','suspensa','confirmada')));
            v_data := v_ref.due_date + v_med.offset_dias;
            IF v_med.tipo = 'negativacao' THEN
              SELECT * INTO v_aviso FROM public.cobranca_acoes_especiais WHERE cobranca_id=_id AND tipo='aviso_negativacao' AND status='confirmada'
                ORDER BY confirmado_em DESC LIMIT 1;
              CONTINUE WHEN v_aviso.id IS NULL;
              v_data := GREATEST(v_data, (v_aviso.confirmado_em AT TIME ZONE 'America/Sao_Paulo')::date);
              CONTINUE WHEN v_hoje < v_data;
            END IF;
            INSERT INTO public.cobranca_acoes_especiais (cobranca_id, tipo, status, data_prevista, parcela_referencia_id)
            VALUES (_id, v_med.tipo, 'pendente', v_data, v_ref.id);
            PERFORM public.cobranca_log(_id,'medida_criada',
              CASE v_med.tipo WHEN 'inativacao' THEN 'Inativação pendente criada — aguardando confirmação manual'
                              WHEN 'aviso_negativacao' THEN 'Aviso de possível negativação criado — aguardando confirmação manual'
                              ELSE 'Negativação pendente criada — aguardando confirmação manual' END,
              jsonb_build_object('tipo',v_med.tipo,'data',v_data),true);
          END LOOP;
        END IF;
        SELECT min(data_prevista) INTO v_data FROM public.cobranca_acoes_especiais WHERE cobranca_id=_id AND status='pendente';
        IF v_data IS NOT NULL THEN v_prox := v_data; v_tipo := 'medida_especial';
        ELSE v_prox := NULL; v_tipo := NULL; END IF;
      END IF;
    END IF;
  END IF;
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
$function$;

CREATE OR REPLACE FUNCTION public.cobranca_sincronizar()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_hoje date := public.cobranca_hoje(); v_janela integer; r record; v_id uuid; v_n integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_access_cobranca(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501';
  END IF;
  SELECT GREATEST(COALESCE(-MIN(offset_dias),0),0) INTO v_janela FROM public.cobranca_regua_etapas WHERE ativo;
  FOR r IN
    SELECT DISTINCT s.id AS sale_id, s.student_name
    FROM public.sales s JOIN public.installments i ON i.sale_id = s.id
    WHERE s.status = 'ativa' AND i.status IN ('pending','due_today','overdue') AND i.due_date <= v_hoje + v_janela
      AND NOT EXISTS (SELECT 1 FROM public.cobrancas c WHERE c.sale_id = s.id AND c.situacao IN ('ativa','monitoramento'))
  LOOP
    -- reaproveita o processo encerrado automaticamente da mesma venda
    SELECT id INTO v_id FROM public.cobrancas WHERE sale_id=r.sale_id AND situacao='encerrada' AND motivo_encerramento='pagamento'
      ORDER BY created_at DESC LIMIT 1;
    IF v_id IS NOT NULL THEN
      UPDATE public.cobrancas SET situacao='ativa', encerrada_em=NULL, motivo_encerramento=NULL WHERE id=v_id;
      PERFORM public.cobranca_log(v_id,'reativacao_automatica','Próxima parcela entrou na régua — cobrança reativada.',NULL,true);
    ELSE
      INSERT INTO public.cobrancas (sale_id, student_id, aluno_nome, origem, created_by)
      VALUES (r.sale_id,
        (SELECT st.id FROM public.students st WHERE lower(trim(st.full_name)) = lower(trim(r.student_name)) ORDER BY st.created_at LIMIT 1),
        r.student_name, 'automatica', auth.uid())
      RETURNING id INTO v_id;
      PERFORM public.cobranca_log(v_id,'cobranca_criada','Cobrança criada automaticamente',NULL,true);
      v_n := v_n + 1;
    END IF;
  END LOOP;
  FOR r IN SELECT id FROM public.cobrancas WHERE situacao IN ('ativa','monitoramento') LOOP
    PERFORM public.cobranca_recalcular_interno(r.id);
  END LOOP;
  RETURN v_n;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cobranca_on_installment_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_cob record;
BEGIN
  FOR v_cob IN SELECT id, situacao FROM public.cobrancas WHERE sale_id = NEW.sale_id AND situacao IN ('ativa','monitoramento') LOOP
    IF v_cob.situacao = 'monitoramento' THEN
      PERFORM public.cobranca_recalcular_interno(v_cob.id);
      CONTINUE;
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('paid','refunded') THEN
      PERFORM public.cobranca_log(v_cob.id, 'pagamento',
        CASE WHEN NEW.status='paid' THEN 'Pagamento registrado através do módulo Financeiro.' ELSE 'Parcela estornada no módulo Financeiro.' END
        || ' (Parcela ' || NEW.installment_number || ', venc. ' || to_char(NEW.due_date,'DD/MM/YYYY') || ')',
        jsonb_build_object('parcela_id', NEW.id, 'status', NEW.status, 'valor_pago', NEW.paid_amount), false);
      UPDATE public.cobranca_agendamentos SET status='cancelado', motivo='Parcela quitada no Financeiro'
       WHERE cobranca_id=v_cob.id AND status='pendente' AND origem='automatica' AND parcela_referencia_id=NEW.id;
      UPDATE public.cobranca_acoes_especiais SET status='cancelada', observacao=COALESCE(observacao,'Parcela quitada no Financeiro')
       WHERE cobranca_id=v_cob.id AND status IN ('pendente','suspensa') AND parcela_referencia_id=NEW.id
         AND NOT EXISTS (SELECT 1 FROM public.installments x WHERE x.sale_id=NEW.sale_id AND x.id<>NEW.id
                         AND x.status IN ('pending','due_today','overdue') AND x.due_date < public.cobranca_hoje());
      PERFORM public.cobranca_recalcular_interno(v_cob.id);
    ELSIF NEW.due_date IS DISTINCT FROM OLD.due_date AND NEW.status IN ('pending','due_today','overdue') THEN
      PERFORM public.cobranca_log(v_cob.id, 'mudanca_automatica',
        'Vencimento alterado no Financeiro: Parcela ' || NEW.installment_number || ' de ' || to_char(OLD.due_date,'DD/MM/YYYY') || ' para ' || to_char(NEW.due_date,'DD/MM/YYYY') || '. Etapas futuras recalculadas.',
        jsonb_build_object('parcela_id', NEW.id, 'anterior', OLD.due_date, 'novo', NEW.due_date), false);
      PERFORM public.cobranca_recalcular_interno(v_cob.id);
    ELSIF NEW.status IS DISTINCT FROM OLD.status OR NEW.value IS DISTINCT FROM OLD.value THEN
      PERFORM public.cobranca_recalcular_interno(v_cob.id);
    END IF;
  END LOOP;
  RETURN NEW;
END; $function$;

COMMENT ON TABLE public.cobranca_medidas_config IS 'Prazos (dias após o vencimento) das medidas pós-régua. Sempre exigem confirmação manual.';