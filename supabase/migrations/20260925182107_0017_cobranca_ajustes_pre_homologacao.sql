-- Ajustes finais pré-homologação da Gestão de Cobranças
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS carteira_inicial boolean NOT NULL DEFAULT false;
ALTER TABLE public.cobrancas ADD COLUMN IF NOT EXISTS carteira_inicial_desde date;
COMMENT ON COLUMN public.cobrancas.carteira_inicial IS 'Processo gerado na implantação com dívida anterior ao módulo e sem cobrança real registrada.';
ALTER TABLE public.cobranca_promessas ADD COLUMN IF NOT EXISTS cumprimento text;
COMMENT ON COLUMN public.cobranca_promessas.cumprimento IS 'NULL | parcialmente_cumprida | cumprida — com base apenas nas parcelas vinculadas.';

CREATE TABLE public.cobranca_promessa_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promessa_id uuid NOT NULL REFERENCES public.cobranca_promessas(id) ON DELETE RESTRICT,
  installment_id uuid NOT NULL REFERENCES public.installments(id) ON DELETE RESTRICT,
  installment_number integer,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promessa_id, installment_id)
);
GRANT SELECT ON public.cobranca_promessa_parcelas TO authenticated;
GRANT ALL ON public.cobranca_promessa_parcelas TO service_role;
ALTER TABLE public.cobranca_promessa_parcelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Promessa parcelas view" ON public.cobranca_promessa_parcelas FOR SELECT TO authenticated USING (public.can_access_cobranca(auth.uid()));
CREATE INDEX idx_cob_prom_parc_inst ON public.cobranca_promessa_parcelas(installment_id);

INSERT INTO public.cobranca_promessa_parcelas (promessa_id, installment_id, installment_number, valor)
SELECT p.id, i.id, i.installment_number, i.value FROM public.cobranca_promessas p
JOIN public.cobrancas c ON c.id=p.cobranca_id JOIN public.installments i ON i.id=c.parcela_referencia_id
WHERE p.status='ativa';

CREATE OR REPLACE FUNCTION public.cobranca_recalcular_interno(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c public.cobrancas%ROWTYPE;
  v_hoje date := public.cobranca_hoje();
  v_janela integer; v_ref record; v_prom record; v_ren record; v_man record; v_etapa record; v_prox_etapa record; v_s record; v_m record;
  v_prox date; v_tipo text; v_etapa_id uuid; v_agend_etapa uuid; v_ult timestamptz;
  v_susp_ini date; v_susp_fim date; v_susp_motivo text; v_max_off integer; v_aviso record; v_data date; v_med record;
  v_last_off integer; v_pend record; v_futuras boolean;
  v_old record; v_ref_mudou boolean := false; v_pt integer; v_pp integer; v_sn record;
BEGIN
  SELECT * INTO c FROM public.cobrancas WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR c.situacao NOT IN ('ativa','monitoramento') THEN RETURN; END IF;
  SELECT COALESCE(-MIN(offset_dias),0), COALESCE(MAX(offset_dias),0) INTO v_janela, v_max_off FROM public.cobranca_regua_etapas WHERE ativo;
  IF v_janela < 0 THEN v_janela := 0; END IF;
  SELECT id, due_date INTO v_ref FROM public.installments
   WHERE sale_id = c.sale_id AND status IN ('pending','due_today','overdue')
   ORDER BY due_date, installment_number LIMIT 1;
  IF v_ref.id IS NULL THEN
    UPDATE public.cobranca_agendamentos SET status='cancelado', motivo='Sem parcela em cobrança' WHERE cobranca_id=_id AND status='pendente';
    UPDATE public.cobranca_promessas SET status='cumprida', resolvida_em=now() WHERE cobranca_id=_id AND status='ativa';
    UPDATE public.cobranca_renegociacoes SET status='concluida' WHERE cobranca_id=_id AND status='ativa';
    UPDATE public.cobranca_acoes_especiais SET status='cancelada', observacao=COALESCE(observacao,'Parcelas quitadas') WHERE cobranca_id=_id AND status IN ('pendente','suspensa');
    PERFORM public.cobranca_log(_id,'pagamento','Parcelas em aberto quitadas',NULL,true);
      UPDATE public.cobrancas SET situacao='encerrada', encerrada_em=now(), motivo_encerramento='pagamento',
        proxima_acao_em=NULL, proxima_acao_tipo=NULL, ultima_acao_em=now(), ultima_acao_descricao='Encerrada: sem parcelas em aberto' WHERE id=_id;
      PERFORM public.cobranca_log(_id,'encerramento','Cobrança encerrada automaticamente',NULL,true);
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
      v_ref_mudou := true;
      SELECT id, due_date, installment_number, status INTO v_old FROM public.installments WHERE id=c.parcela_referencia_id;
      -- Nunca criar etapa retroativa para a nova parcela: etapas já passadas ficam como não aplicáveis
      FOR v_sn IN SELECT e.id, e.codigo FROM public.cobranca_regua_etapas e
        WHERE e.ativo AND v_ref.due_date + e.offset_dias < v_hoje
          AND NOT EXISTS (SELECT 1 FROM public.collection_attempts a WHERE a.cobranca_id=_id AND a.etapa_id=e.id AND a.installment_id=v_ref.id AND a.tipo_interacao='cobranca')
          AND NOT EXISTS (SELECT 1 FROM public.cobranca_eventos ev WHERE ev.cobranca_id=_id AND ev.tipo IN ('etapa_suspensa','etapa_nao_aplicavel')
                AND ev.dados->>'etapa_id'=e.id::text AND ev.dados->>'parcela_id'=v_ref.id::text)
      LOOP
        PERFORM public.cobranca_log(_id,'etapa_nao_aplicavel','Etapa '||v_sn.codigo||' não aplicável: parcela assumiu como referência após a data da etapa.',
          jsonb_build_object('etapa_id',v_sn.id,'parcela_id',v_ref.id),true);
      END LOOP;
    END IF;
    c.parcela_referencia_id := v_ref.id;
  END IF;
  SELECT * INTO v_prom FROM public.cobranca_promessas WHERE cobranca_id=_id AND status='ativa' ORDER BY created_at DESC LIMIT 1;
  SELECT * INTO v_ren FROM public.cobranca_renegociacoes WHERE cobranca_id=_id AND status='ativa' ORDER BY created_at DESC LIMIT 1;

  -- Promessa com escopo de parcelas: cumprida somente com base nas parcelas vinculadas
  IF v_prom.id IS NOT NULL THEN
    SELECT count(*), count(*) FILTER (WHERE i.status IN ('paid','refunded')) INTO v_pt, v_pp
      FROM public.cobranca_promessa_parcelas pp JOIN public.installments i ON i.id=pp.installment_id WHERE pp.promessa_id=v_prom.id;
    IF v_pt > 0 AND v_pp = v_pt THEN
      UPDATE public.cobranca_promessas SET status='cumprida', cumprimento='cumprida', resolvida_em=now() WHERE id=v_prom.id;
      PERFORM public.cobranca_log(_id,'promessa_cumprida','Promessa cumprida através de baixa realizada no Financeiro.',jsonb_build_object('promessa_id',v_prom.id),true);
      UPDATE public.cobrancas SET ultima_acao_em=now(), ultima_acao_descricao='Promessa cumprida' WHERE id=_id;
      SELECT * INTO v_prom FROM public.cobranca_promessas WHERE false;
    ELSIF v_pp > 0 AND v_prom.cumprimento IS DISTINCT FROM 'parcialmente_cumprida' THEN
      UPDATE public.cobranca_promessas SET cumprimento='parcialmente_cumprida' WHERE id=v_prom.id;
      PERFORM public.cobranca_log(_id,'promessa_parcial','Promessa parcialmente cumprida: '||v_pp||' de '||v_pt||' parcela(s) prometida(s) paga(s).',
        jsonb_build_object('promessa_id',v_prom.id,'pagas',v_pp,'total',v_pt),true);
    END IF;
  END IF;

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
      -- Carteira inicial: primeira ação conta a partir da entrada no módulo, não do vencimento antigo
      IF c.carteira_inicial AND c.carteira_inicial_desde IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public.collection_attempts WHERE cobranca_id=_id AND tipo_interacao='cobranca') THEN
        v_prox := GREATEST(v_prox, c.carteira_inicial_desde);
      END IF;
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
  IF v_ref_mudou THEN
    PERFORM public.cobranca_log(_id,'mudanca_automatica','Parcela de referência alterada.',
      jsonb_build_object('parcela_anterior',v_old.id,'parcela_anterior_numero',v_old.installment_number,'vencimento_anterior',v_old.due_date,
        'parcela_nova',v_ref.id,'parcela_nova_numero',(SELECT installment_number FROM public.installments WHERE id=v_ref.id),'vencimento_novo',v_ref.due_date,
        'motivo',CASE WHEN v_old.status IN ('paid','refunded') THEN 'Parcela anterior quitada/estornada' WHEN v_old.id IS NULL THEN 'Parcela anterior removida' ELSE 'Parcela mais antiga em aberto mudou' END,
        'proxima_etapa',(SELECT codigo FROM public.cobranca_regua_etapas WHERE id=COALESCE(v_agend_etapa,v_etapa_id)),'proxima_acao_em',v_prox,'proxima_acao_tipo',v_tipo),true);
    IF v_hoje > v_ref.due_date + v_max_off THEN
      PERFORM public.cobranca_log(_id,'fora_da_regua','Parcela assumiu como referência já fora da régua automática — segue para o fluxo pós-régua.',
        jsonb_build_object('parcela_id',v_ref.id),true);
    END IF;
  END IF;
  UPDATE public.cobrancas SET parcela_referencia_id=c.parcela_referencia_id, etapa_atual_id=v_etapa_id,
         proxima_acao_em=v_prox, proxima_acao_tipo=v_tipo
   WHERE id=_id AND (parcela_referencia_id IS DISTINCT FROM c.parcela_referencia_id OR etapa_atual_id IS DISTINCT FROM v_etapa_id
         OR proxima_acao_em IS DISTINCT FROM v_prox OR proxima_acao_tipo IS DISTINCT FROM v_tipo);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.cobranca_on_installment_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
      IF NEW.status='paid' AND EXISTS (SELECT 1 FROM public.cobranca_agendamentos WHERE cobranca_id=v_cob.id AND status='pendente'
            AND origem='automatica' AND parcela_referencia_id=NEW.id AND data > public.cobranca_hoje()) THEN
        UPDATE public.cobranca_agendamentos SET status='cancelado', motivo='Quitação antecipada da parcela'
         WHERE cobranca_id=v_cob.id AND status='pendente' AND origem='automatica' AND parcela_referencia_id=NEW.id AND data > public.cobranca_hoje();
        PERFORM public.cobranca_log(v_cob.id,'cancelamento_agendamento','Cobrança futura cancelada devido à quitação antecipada da parcela.',
          jsonb_build_object('parcela_id',NEW.id),true);
      END IF;
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
END; $function$
;
CREATE OR REPLACE FUNCTION public.cobranca_resolver_promessa(_cobranca uuid, _acao text, _observacao text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_p record;
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  IF _acao NOT IN ('pago','nao_pagou') THEN RAISE EXCEPTION 'Ação inválida'; END IF;
  SELECT * INTO v_p FROM public.cobranca_promessas WHERE cobranca_id=_cobranca AND status='ativa' ORDER BY created_at DESC LIMIT 1;
  IF v_p.id IS NULL THEN
    IF _acao='pago' AND EXISTS (SELECT 1 FROM public.cobranca_promessas WHERE cobranca_id=_cobranca AND status='cumprida' AND resolvida_em > now() - interval '10 minutes') THEN RETURN; END IF;
    RAISE EXCEPTION 'Nenhuma promessa ativa';
  END IF;
  IF _acao = 'pago' THEN
    UPDATE public.cobranca_promessas SET status='cumprida', cumprimento='cumprida', resolvida_em=now() WHERE id=v_p.id;
    PERFORM public.cobranca_log(_cobranca,'promessa_cumprida','Pagamento da promessa confirmado pelo operador'||COALESCE(' — '||_observacao,''),jsonb_build_object('promessa_id',v_p.id));
    UPDATE public.cobrancas SET ultima_acao_em=now(), ultima_acao_descricao='Pagamento confirmado' WHERE id=_cobranca;
  ELSE
    UPDATE public.cobranca_promessas SET status='nao_cumprida', resolvida_em=now() WHERE id=v_p.id;
    PERFORM public.cobranca_log(_cobranca,'promessa_nao_cumprida','Promessa não cumprida.'||COALESCE(' '||_observacao,''),jsonb_build_object('promessa_id',v_p.id));
    PERFORM public.cobranca_log(_cobranca,'retomada_regua','Régua retomada após promessa não cumprida',NULL,true);
    UPDATE public.cobrancas SET ultima_acao_em=now(), ultima_acao_descricao='Promessa não cumprida' WHERE id=_cobranca;
  END IF;
  PERFORM public.cobranca_recalcular_interno(_cobranca);
END; $function$
;
DROP FUNCTION IF EXISTS public.cobranca_registrar_promessa(uuid, date, numeric, text);
CREATE FUNCTION public.cobranca_registrar_promessa(_cobranca uuid, _data date, _valor numeric DEFAULT NULL::numeric, _observacao text DEFAULT NULL::text, _parcelas uuid[] DEFAULT NULL::uuid[])
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_old record; v_id uuid; v_sale uuid; v_ref uuid; v_parc uuid[]; v_total numeric; v_n integer;
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
  IF _data < public.cobranca_hoje() THEN RAISE EXCEPTION 'Data da promessa não pode ser no passado'; END IF;
  SELECT sale_id, parcela_referencia_id INTO v_sale, v_ref FROM public.cobrancas WHERE id=_cobranca;
  SELECT * INTO v_old FROM public.cobranca_promessas WHERE cobranca_id=_cobranca AND status='ativa' LIMIT 1;
  v_parc := _parcelas;
  IF v_parc IS NULL OR array_length(v_parc,1) IS NULL THEN
    v_parc := NULL;
    IF v_old.id IS NOT NULL THEN
      SELECT array_agg(pp.installment_id) INTO v_parc FROM public.cobranca_promessa_parcelas pp JOIN public.installments i ON i.id=pp.installment_id
       WHERE pp.promessa_id=v_old.id AND i.status IN ('pending','due_today','overdue');
    END IF;
    IF v_parc IS NULL AND v_ref IS NOT NULL THEN v_parc := ARRAY[v_ref]; END IF;
  END IF;
  SELECT count(*), COALESCE(sum(value),0) INTO v_n, v_total FROM public.installments
   WHERE id = ANY(v_parc) AND sale_id=v_sale AND status IN ('pending','due_today','overdue');
  IF v_parc IS NOT NULL AND v_n <> array_length(v_parc,1) THEN RAISE EXCEPTION 'Parcelas inválidas para esta cobrança'; END IF;
  IF v_old.id IS NOT NULL THEN
    UPDATE public.cobranca_promessas SET status='prorrogada', resolvida_em=now() WHERE id=v_old.id;
  END IF;
  INSERT INTO public.cobranca_promessas (cobranca_id, data_prometida, valor_prometido, observacao, user_id, promessa_anterior_id)
  VALUES (_cobranca, _data, COALESCE(_valor, NULLIF(v_total,0)), _observacao, auth.uid(), v_old.id) RETURNING id INTO v_id;
  INSERT INTO public.cobranca_promessa_parcelas (promessa_id, installment_id, installment_number, valor)
  SELECT v_id, i.id, i.installment_number, i.value FROM public.installments i WHERE i.id = ANY(v_parc);
  PERFORM public.cobranca_log(_cobranca, CASE WHEN v_old.id IS NULL THEN 'promessa_criada' ELSE 'promessa_prorrogada' END,
    'Promessa para '||to_char(_data,'DD/MM/YYYY')||' — parcela(s) '||COALESCE((SELECT string_agg(installment_number::text,', ' ORDER BY installment_number) FROM public.installments WHERE id=ANY(v_parc)),'—'),
    jsonb_build_object('valor',COALESCE(_valor,v_total),'valor_parcelas',v_total,'parcelas',to_jsonb(v_parc),'promessa_id',v_id,'anterior',v_old.id));
  UPDATE public.cobrancas SET ultima_acao_em=now(), ultima_acao_descricao='Promessa para '||to_char(_data,'DD/MM/YYYY') WHERE id=_cobranca;
  PERFORM public.cobranca_recalcular_interno(_cobranca);
  RETURN v_id;
END; $function$;
REVOKE ALL ON FUNCTION public.cobranca_registrar_promessa(uuid, date, numeric, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cobranca_registrar_promessa(uuid, date, numeric, text, uuid[]) TO authenticated;

CREATE OR REPLACE VIEW public.cobrancas_painel WITH (security_invoker = true) AS
SELECT c.id,
    c.sale_id,
    c.student_id,
    c.aluno_nome,
    c.responsavel_id,
    c.situacao,
    c.origem,
    c.parcela_referencia_id,
    c.etapa_atual_id,
    c.proxima_acao_em,
    c.proxima_acao_tipo,
    c.ultima_acao_em,
    c.ultima_acao_descricao,
    c.motivo_encerramento,
    c.encerrada_em,
    c.created_by,
    c.created_at,
    c.updated_at,
        CASE
            WHEN c.situacao <> 'ativa'::text THEN 'encerrada'::text
            WHEN c.proxima_acao_em IS NULL THEN 'sem_agendamento'::text
            WHEN c.proxima_acao_em = cobranca_hoje() THEN 'hoje'::text
            WHEN c.proxima_acao_em < cobranca_hoje() THEN 'atrasados'::text
            ELSE 'agendados'::text
        END AS situacao_operacional,
    e.codigo AS etapa_codigo,
    i.due_date AS parcela_vencimento,
    i.installment_number AS parcela_numero,
    i.value AS parcela_valor,
    ( SELECT count(*) AS count
           FROM installments x
          WHERE x.sale_id = c.sale_id AND (x.status = ANY (ARRAY['pending'::text, 'due_today'::text, 'overdue'::text])) AND x.due_date < cobranca_hoje()) AS parcelas_vencidas,
    ( SELECT COALESCE(sum(x.value), 0::numeric) AS "coalesce"
           FROM installments x
          WHERE x.sale_id = c.sale_id AND (x.status = ANY (ARRAY['pending'::text, 'due_today'::text, 'overdue'::text])) AND x.due_date < cobranca_hoje()) AS valor_vencido,
    c.carteira_inicial,
    c.carteira_inicial_desde,
    ( SELECT pe.codigo FROM cobranca_agendamentos ag JOIN cobranca_regua_etapas pe ON pe.id = ag.etapa_id
          WHERE ag.cobranca_id = c.id AND ag.status = 'pendente'::text AND ag.origem = 'automatica'::text
          ORDER BY ag.data LIMIT 1) AS proxima_etapa_codigo
   FROM cobrancas c
     LEFT JOIN cobranca_regua_etapas e ON e.id = c.etapa_atual_id
     LEFT JOIN installments i ON i.id = c.parcela_referencia_id;

UPDATE public.cobrancas SET situacao='ativa' WHERE situacao='monitoramento';

UPDATE public.cobrancas c SET carteira_inicial=true, carteira_inicial_desde=public.cobranca_hoje()
WHERE c.situacao='ativa' AND c.origem='automatica'
  AND NOT EXISTS (SELECT 1 FROM public.collection_attempts a WHERE a.cobranca_id=c.id AND a.tipo_interacao='cobranca')
  AND EXISTS (SELECT 1 FROM public.installments i WHERE i.id=c.parcela_referencia_id AND i.due_date < (c.created_at AT TIME ZONE 'America/Sao_Paulo')::date);

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.cobrancas WHERE situacao='ativa' LOOP PERFORM public.cobranca_recalcular_interno(r.id); END LOOP;
END $$;
