CREATE TABLE IF NOT EXISTS public.cobranca_medidas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL UNIQUE CHECK (tipo IN ('inativacao','aviso_negativacao','negativacao')),
  offset_dias integer NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.cobranca_medidas_config TO authenticated;
GRANT ALL ON public.cobranca_medidas_config TO service_role;
ALTER TABLE public.cobranca_medidas_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cobranca medidas select" ON public.cobranca_medidas_config FOR SELECT TO authenticated USING (public.can_access_cobranca(auth.uid()));
CREATE POLICY "cobranca medidas gestao" ON public.cobranca_medidas_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gerente'));
INSERT INTO public.cobranca_medidas_config (tipo, offset_dias) VALUES ('inativacao',31),('aviso_negativacao',31),('negativacao',45) ON CONFLICT (tipo) DO NOTHING;

ALTER TABLE public.cobranca_acoes_especiais ADD COLUMN IF NOT EXISTS data_prevista date;
ALTER TABLE public.cobranca_acoes_especiais ADD COLUMN IF NOT EXISTS parcela_referencia_id uuid REFERENCES public.installments(id);

CREATE OR REPLACE FUNCTION public.cobranca_recalcular_interno(_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  c public.cobrancas%ROWTYPE;
  v_hoje date := public.cobranca_hoje();
  v_janela integer; v_ref record; v_prom record; v_ren record; v_man record; v_etapa record; v_prox_etapa record; v_s record; v_m record;
  v_done boolean; v_prox date; v_tipo text; v_etapa_id uuid; v_agend_etapa uuid; v_ult timestamptz;
  v_susp_ini date; v_susp_fim date; v_susp_motivo text; v_max_off integer; v_aviso record; v_data date; v_med record;
BEGIN
  SELECT * INTO c FROM public.cobrancas WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR c.situacao <> 'ativa' THEN RETURN; END IF;
  SELECT COALESCE(-MIN(offset_dias),0), COALESCE(MAX(offset_dias),0) INTO v_janela, v_max_off FROM public.cobranca_regua_etapas WHERE ativo;
  IF v_janela < 0 THEN v_janela := 0; END IF;
  SELECT id, due_date INTO v_ref FROM public.installments
   WHERE sale_id = c.sale_id AND status IN ('pending','due_today','overdue') AND due_date <= v_hoje + v_janela
   ORDER BY due_date, installment_number LIMIT 1;
  IF v_ref.id IS NULL THEN
    UPDATE public.cobrancas SET situacao='encerrada', encerrada_em=now(), motivo_encerramento='pagamento',
      proxima_acao_em=NULL, proxima_acao_tipo=NULL, ultima_acao_em=now(), ultima_acao_descricao='Encerrada: sem parcelas em aberto' WHERE id=_id;
    UPDATE public.cobranca_agendamentos SET status='cancelado', motivo='Cobrança encerrada' WHERE cobranca_id=_id AND status='pendente';
    UPDATE public.cobranca_promessas SET status='cumprida', resolvida_em=now() WHERE cobranca_id=_id AND status='ativa';
    UPDATE public.cobranca_renegociacoes SET status='concluida' WHERE cobranca_id=_id AND status='ativa';
    UPDATE public.cobranca_acoes_especiais SET status='cancelada', observacao=COALESCE(observacao,'Cobrança encerrada') WHERE cobranca_id=_id AND status IN ('pendente','suspensa');
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
  SELECT * INTO v_prom FROM public.cobranca_promessas WHERE cobranca_id=_id AND status='ativa' ORDER BY created_at DESC LIMIT 1;
  SELECT * INTO v_ren FROM public.cobranca_renegociacoes WHERE cobranca_id=_id AND status='ativa' ORDER BY created_at DESC LIMIT 1;

  -- Medidas suspensas por renegociação voltam a ficar pendentes quando não há renegociação ativa
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
        WHERE cobranca_id=_id AND etapa_id=v_etapa.id AND installment_id=v_ref.id AND tipo_interacao='cobranca')
        OR EXISTS (SELECT 1 FROM public.cobranca_eventos WHERE cobranca_id=_id AND tipo='etapa_suspensa'
          AND dados->>'etapa_id'=v_etapa.id::text AND dados->>'parcela_id'=v_ref.id::text)
      INTO v_done;
    END IF;
    IF v_etapa.id IS NOT NULL AND NOT v_done THEN
      v_prox := v_ref.due_date + v_etapa.offset_dias; v_tipo := 'regua'; v_agend_etapa := v_etapa.id;
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
       WHERE ativo AND v_ref.due_date + offset_dias > v_hoje ORDER BY offset_dias LIMIT 1;
      IF v_prox_etapa.id IS NOT NULL THEN
        v_prox := v_ref.due_date + v_prox_etapa.offset_dias; v_tipo := 'regua'; v_agend_etapa := v_prox_etapa.id;
      ELSE
        -- Régua concluída: criar medidas especiais configuradas (nunca executadas automaticamente)
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
        IF v_data IS NOT NULL THEN
          v_prox := v_data; v_tipo := 'medida_especial';
        ELSE
          v_prox := NULL; v_tipo := NULL;
        END IF;
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

CREATE OR REPLACE FUNCTION public.cobranca_acao_especial(_cobranca uuid, _tipo text, _status text, _observacao text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; c public.cobrancas%ROWTYPE; v_desc text; v_nome text;
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.cobrancas WHERE id=_cobranca;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cobrança não encontrada'; END IF;
  IF _status IN ('confirmada','suspensa') AND COALESCE(trim(_observacao),'') = '' THEN RAISE EXCEPTION 'Informe a observação'; END IF;
  SELECT id INTO v_id FROM public.cobranca_acoes_especiais WHERE cobranca_id=_cobranca AND tipo=_tipo AND status IN ('pendente','suspensa') ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.cobranca_acoes_especiais (cobranca_id, tipo, status, observacao, solicitado_por, confirmado_por, confirmado_em, data_prevista, parcela_referencia_id)
    VALUES (_cobranca, _tipo, _status, _observacao, auth.uid(),
      CASE WHEN _status='confirmada' THEN auth.uid() END, CASE WHEN _status='confirmada' THEN now() END, public.cobranca_hoje(), c.parcela_referencia_id)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.cobranca_acoes_especiais SET status=_status, observacao=COALESCE(_observacao,observacao),
      confirmado_por = CASE WHEN _status='confirmada' THEN auth.uid() ELSE confirmado_por END,
      confirmado_em = CASE WHEN _status='confirmada' THEN now() ELSE confirmado_em END
     WHERE id=v_id;
  END IF;
  IF _status='confirmada' AND _tipo='inativacao' THEN
    UPDATE public.sales SET aluno_inativado_inadimplencia = true WHERE id=c.sale_id;
  ELSIF _status='confirmada' AND _tipo='negativacao' THEN
    UPDATE public.installments SET negativado_spc = true, negativado_spc_at = now()
     WHERE sale_id=c.sale_id AND status IN ('pending','due_today','overdue') AND due_date < public.cobranca_hoje() AND NOT negativado_spc;
  END IF;
  SELECT nome INTO v_nome FROM public.vendedores WHERE user_id=auth.uid() LIMIT 1;
  v_desc := CASE
    WHEN _tipo='inativacao' AND _status='confirmada' THEN 'Plataforma inativada por inadimplência.'
    WHEN _tipo='aviso_negativacao' AND _status='confirmada' THEN 'Aviso de possível negativação confirmado.'
    WHEN _tipo='negativacao' AND _status='confirmada' THEN 'Negativação confirmada.'
    WHEN _status='suspensa' THEN CASE _tipo WHEN 'inativacao' THEN 'Inativação' WHEN 'aviso_negativacao' THEN 'Aviso de possível negativação' ELSE 'Negativação' END || ' suspensa por renegociação.'
    ELSE _tipo||' → '||_status END;
  v_desc := v_desc || ' Por ' || COALESCE(v_nome,'usuário') || ' em ' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') || COALESCE(' — '||_observacao,'');
  UPDATE public.cobrancas SET ultima_acao_em=now(), ultima_acao_descricao=left(v_desc,200) WHERE id=_cobranca;
  PERFORM public.cobranca_log(_cobranca, CASE WHEN _tipo='inativacao' THEN 'inativacao' ELSE 'negativacao' END,
    v_desc, jsonb_build_object('acao_id',v_id,'tipo',_tipo,'status',_status));
  PERFORM public.cobranca_recalcular_interno(_cobranca);
  RETURN v_id;
END; $function$;