CREATE OR REPLACE FUNCTION public.cobranca_recalcular_interno(_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  c public.cobrancas%ROWTYPE;
  v_hoje date := public.cobranca_hoje();
  v_janela integer; v_ref record; v_prom record; v_ren record; v_man record; v_etapa record; v_prox_etapa record; v_s record;
  v_done boolean; v_prox date; v_tipo text; v_etapa_id uuid; v_agend_etapa uuid; v_ult timestamptz;
  v_susp_ini date; v_susp_fim date; v_susp_motivo text;
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
    UPDATE public.cobranca_renegociacoes SET status='concluida' WHERE cobranca_id=_id AND status='ativa';
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
  -- Promessa e renegociação permanecem ativas até o operador resolver (vencidas vão para Atrasados)
  SELECT * INTO v_prom FROM public.cobranca_promessas WHERE cobranca_id=_id AND status='ativa' ORDER BY created_at DESC LIMIT 1;
  SELECT * INTO v_ren FROM public.cobranca_renegociacoes WHERE cobranca_id=_id AND status='ativa' ORDER BY created_at DESC LIMIT 1;

  -- Registrar etapas suspensas (sem apagar)
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

CREATE OR REPLACE FUNCTION public.cobranca_registrar_renegociacao(_cobranca uuid, _inicio date, _suspensa_ate date, _observacao text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_old uuid;
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  IF _suspensa_ate IS NOT NULL AND _suspensa_ate < _inicio THEN RAISE EXCEPTION 'Data final anterior ao início'; END IF;
  SELECT id INTO v_old FROM public.cobranca_renegociacoes WHERE cobranca_id=_cobranca AND status='ativa' ORDER BY created_at DESC LIMIT 1;
  UPDATE public.cobranca_renegociacoes SET status='cancelada' WHERE cobranca_id=_cobranca AND status='ativa';
  -- promessa ativa tem prioridade conceitual; nova renegociação substitui promessa para evitar ações contraditórias
  UPDATE public.cobranca_promessas SET status='cancelada', resolvida_em=now() WHERE cobranca_id=_cobranca AND status='ativa';
  INSERT INTO public.cobranca_renegociacoes (cobranca_id, inicio, suspensa_ate, observacao, user_id)
  VALUES (_cobranca, _inicio, _suspensa_ate, _observacao, auth.uid()) RETURNING id INTO v_id;
  PERFORM public.cobranca_log(_cobranca, CASE WHEN v_old IS NULL THEN 'renegociacao' ELSE 'renegociacao_prorrogada' END,
    CASE WHEN v_old IS NULL THEN 'Renegociação registrada' ELSE 'Renegociação prorrogada' END
      || COALESCE(' até '||to_char(_suspensa_ate,'DD/MM/YYYY'),''),
    jsonb_build_object('inicio',_inicio,'suspensa_ate',_suspensa_ate,'id',v_id,'anterior',v_old,'observacao',_observacao));
  UPDATE public.cobrancas SET ultima_acao_em=now(), ultima_acao_descricao='Renegociação'||COALESCE(' até '||to_char(_suspensa_ate,'DD/MM/YYYY'),'') WHERE id=_cobranca;
  PERFORM public.cobranca_recalcular_interno(_cobranca);
  RETURN v_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.cobranca_resolver_promessa(_cobranca uuid, _acao text, _observacao text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_p record;
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  IF _acao NOT IN ('pago','nao_pagou') THEN RAISE EXCEPTION 'Ação inválida'; END IF;
  SELECT * INTO v_p FROM public.cobranca_promessas WHERE cobranca_id=_cobranca AND status='ativa' ORDER BY created_at DESC LIMIT 1;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Nenhuma promessa ativa'; END IF;
  IF _acao = 'pago' THEN
    UPDATE public.cobranca_promessas SET status='cumprida', resolvida_em=now() WHERE id=v_p.id;
    PERFORM public.cobranca_log(_cobranca,'promessa_cumprida','Pagamento da promessa confirmado pelo operador'||COALESCE(' — '||_observacao,''),jsonb_build_object('promessa_id',v_p.id));
    UPDATE public.cobrancas SET ultima_acao_em=now(), ultima_acao_descricao='Pagamento confirmado' WHERE id=_cobranca;
  ELSE
    UPDATE public.cobranca_promessas SET status='nao_cumprida', resolvida_em=now() WHERE id=v_p.id;
    PERFORM public.cobranca_log(_cobranca,'promessa_nao_cumprida','Promessa não cumprida.'||COALESCE(' '||_observacao,''),jsonb_build_object('promessa_id',v_p.id));
    PERFORM public.cobranca_log(_cobranca,'retomada_regua','Régua retomada após promessa não cumprida',NULL,true);
    UPDATE public.cobrancas SET ultima_acao_em=now(), ultima_acao_descricao='Promessa não cumprida' WHERE id=_cobranca;
  END IF;
  PERFORM public.cobranca_recalcular_interno(_cobranca);
END; $function$;

CREATE OR REPLACE FUNCTION public.cobranca_resolver_renegociacao(_cobranca uuid, _acao text, _observacao text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_r record;
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  IF _acao NOT IN ('regularizado','nao_regularizado') THEN RAISE EXCEPTION 'Ação inválida'; END IF;
  SELECT * INTO v_r FROM public.cobranca_renegociacoes WHERE cobranca_id=_cobranca AND status='ativa' ORDER BY created_at DESC LIMIT 1;
  IF v_r.id IS NULL THEN RAISE EXCEPTION 'Nenhuma renegociação ativa'; END IF;
  IF _acao = 'regularizado' THEN
    UPDATE public.cobranca_renegociacoes SET status='concluida' WHERE id=v_r.id;
    PERFORM public.cobranca_log(_cobranca,'renegociacao_regularizada','Renegociação regularizada'||COALESCE(' — '||_observacao,''),jsonb_build_object('id',v_r.id));
    UPDATE public.cobrancas SET ultima_acao_em=now(), ultima_acao_descricao='Renegociação regularizada' WHERE id=_cobranca;
  ELSE
    UPDATE public.cobranca_renegociacoes SET status='quebrada' WHERE id=v_r.id;
    PERFORM public.cobranca_log(_cobranca,'renegociacao_nao_regularizada','Renegociação não regularizada'||COALESCE(' — '||_observacao,''),jsonb_build_object('id',v_r.id));
    PERFORM public.cobranca_log(_cobranca,'retomada_regua','Régua retomada após renegociação não regularizada',NULL,true);
    UPDATE public.cobrancas SET ultima_acao_em=now(), ultima_acao_descricao='Renegociação não regularizada' WHERE id=_cobranca;
  END IF;
  PERFORM public.cobranca_recalcular_interno(_cobranca);
END; $function$;

REVOKE ALL ON FUNCTION public.cobranca_resolver_promessa(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cobranca_resolver_renegociacao(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cobranca_resolver_promessa(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cobranca_resolver_renegociacao(uuid,text,text) TO authenticated;