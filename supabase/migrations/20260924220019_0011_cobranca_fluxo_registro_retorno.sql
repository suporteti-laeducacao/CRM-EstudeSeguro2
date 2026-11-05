CREATE OR REPLACE FUNCTION public.cobranca_recalcular_interno(_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  c public.cobrancas%ROWTYPE;
  v_hoje date := public.cobranca_hoje();
  v_janela integer; v_ref record; v_prom record; v_ren record; v_man record; v_etapa record; v_prox_etapa record;
  v_done boolean; v_prox date; v_tipo text; v_etapa_id uuid; v_agend_etapa uuid; v_ult timestamptz;
BEGIN
  SELECT * INTO c FROM public.cobrancas WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR c.situacao <> 'ativa' THEN RETURN; END IF;
  SELECT COALESCE(-MIN(offset_dias),0) INTO v_janela FROM public.cobranca_regua_etapas WHERE ativo;
  IF v_janela < 0 THEN v_janela := 0; END IF;
  SELECT id, due_date INTO v_ref FROM public.installments
   WHERE sale_id = c.sale_id AND status IN ('pending','due_today','overdue') AND due_date <= v_hoje + v_janela
   ORDER BY due_date, installment_number LIMIT 1;
  IF v_ref.id IS NULL THEN
    UPDATE public.cobrancas SET situacao='encerrada', encerrada_em=now(), motivo_encerramento='pagamento',
      proxima_acao_em=NULL, proxima_acao_tipo=NULL, ultima_acao_em=now(), ultima_acao_descricao='Encerrada: sem parcelas em aberto' WHERE id=_id;
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
  SELECT * INTO v_prom FROM public.cobranca_promessas WHERE cobranca_id=_id AND status='ativa' LIMIT 1;
  IF v_prom.id IS NOT NULL AND v_prom.data_prometida < v_hoje THEN
    UPDATE public.cobranca_promessas SET status='nao_cumprida', resolvida_em=now() WHERE id=v_prom.id;
    PERFORM public.cobranca_log(_id,'promessa_nao_cumprida','Promessa de '||to_char(v_prom.data_prometida,'DD/MM/YYYY')||' não cumprida',NULL,true);
    PERFORM public.cobranca_log(_id,'retomada_regua','Régua retomada após promessa não cumprida',NULL,true);
    v_prom := NULL;
  END IF;
  SELECT * INTO v_ren FROM public.cobranca_renegociacoes WHERE cobranca_id=_id AND status='ativa' ORDER BY created_at DESC LIMIT 1;
  IF v_ren.id IS NOT NULL AND v_ren.suspensa_ate IS NOT NULL AND v_ren.suspensa_ate < v_hoje THEN
    UPDATE public.cobranca_renegociacoes SET status='expirada' WHERE id=v_ren.id;
    PERFORM public.cobranca_log(_id,'retomada_regua','Régua retomada após fim da suspensão da renegociação',NULL,true);
    v_ren := NULL;
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
        WHERE cobranca_id=_id AND etapa_id=v_etapa.id AND installment_id=v_ref.id AND tipo_interacao='cobranca') INTO v_done;
    END IF;
    IF v_etapa.id IS NOT NULL AND NOT v_done THEN
      v_prox := v_ref.due_date + v_etapa.offset_dias; v_tipo := 'regua'; v_agend_etapa := v_etapa.id;
      -- Nova etapa chegou: cobrança anterior sem retorno?
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
        v_prox := NULL; v_tipo := NULL;
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

CREATE OR REPLACE FUNCTION public.cobranca_registrar_interacao(_cobranca uuid, _tipo text, _canal text, _resultado text, _observacao text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c public.cobrancas%ROWTYPE; v_id uuid; v_etapa uuid; v_desc text; v_canal_l text;
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM public.cobrancas WHERE id=_cobranca;
  IF NOT FOUND OR c.situacao <> 'ativa' THEN RAISE EXCEPTION 'Cobrança não está ativa'; END IF;
  IF c.parcela_referencia_id IS NULL THEN RAISE EXCEPTION 'Cobrança sem parcela de referência'; END IF;
  SELECT etapa_id INTO v_etapa FROM public.cobranca_agendamentos
   WHERE cobranca_id=_cobranca AND origem='automatica' AND status='pendente' AND data <= public.cobranca_hoje() ORDER BY data LIMIT 1;
  v_etapa := COALESCE(v_etapa, c.etapa_atual_id);
  v_canal_l := CASE _canal WHEN 'whatsapp' THEN 'WhatsApp' WHEN 'phone' THEN 'Ligação' WHEN 'email' THEN 'E-mail' WHEN 'sms' THEN 'SMS' WHEN 'presencial' THEN 'Presencial' ELSE 'Outro' END;

  INSERT INTO public.collection_attempts (user_id, installment_id, sale_id, cobranca_id, etapa_id, tipo_interacao, date, method, resultado, notes)
  VALUES (auth.uid(), c.parcela_referencia_id, c.sale_id, _cobranca, CASE WHEN _tipo='cobranca' THEN v_etapa END, _tipo, now(), _canal, COALESCE(_resultado,'aguardando_retorno'), _observacao)
  RETURNING id INTO v_id;

  IF _tipo = 'cobranca' THEN
    UPDATE public.cobranca_agendamentos SET status='realizado', user_id=auth.uid()
     WHERE cobranca_id=_cobranca AND status='pendente' AND data <= public.cobranca_hoje()
       AND (origem='manual' OR etapa_id = v_etapa);
  END IF;

  v_desc := CASE
    WHEN _tipo='cobranca' AND _resultado='nao_atendeu' THEN 'Tentativa de ligação — não atendeu'
    WHEN _tipo='cobranca' THEN 'Cobrança realizada ('||v_canal_l||')'
    WHEN _tipo='retorno' THEN 'Retorno do aluno ('||v_canal_l||')'
    ELSE 'Observação' END;
  UPDATE public.cobrancas SET ultima_acao_em=now(), ultima_acao_descricao=v_desc WHERE id=_cobranca;
  PERFORM public.cobranca_log(_cobranca, CASE _tipo WHEN 'cobranca' THEN 'cobranca_realizada' WHEN 'retorno' THEN 'retorno_recebido' ELSE 'observacao' END,
    v_desc || COALESCE(' — '||_observacao,''), jsonb_build_object('canal',_canal,'resultado',_resultado,'etapa_id',v_etapa,'interacao_id',v_id));
  PERFORM public.cobranca_recalcular_interno(_cobranca);
  RETURN v_id;
END; $function$;