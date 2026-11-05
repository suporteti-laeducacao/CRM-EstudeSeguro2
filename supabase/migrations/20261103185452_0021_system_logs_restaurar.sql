ALTER TABLE public.system_logs ADD COLUMN IF NOT EXISTS restaurado_em timestamptz, ADD COLUMN IF NOT EXISTS restaurado_por uuid;

CREATE OR REPLACE FUNCTION public.system_logs_restaurar(_log_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_pend uuid[]; v_prox uuid[]; r record; v_ok int := 0; v_existe boolean; v_progresso boolean;
  v_erros jsonb := '[]'::jsonb; v_ultimo_erro jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Somente administradores podem restaurar registros' USING ERRCODE='42501'; END IF;
  SELECT array_agg(id) INTO v_pend FROM public.system_logs
   WHERE id = ANY(_log_ids) AND action='DELETE' AND restaurado_em IS NULL AND old_data IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.triggers t WHERE t.event_object_schema='public'
                 AND t.event_object_table=system_logs.table_name AND t.action_statement ILIKE '%log_system_change%');
  -- Repete em várias passadas para respeitar a ordem de dependência (ex.: credor antes da conta)
  LOOP
    EXIT WHEN v_pend IS NULL OR array_length(v_pend,1) IS NULL;
    v_progresso := false; v_prox := ARRAY[]::uuid[];
    FOR r IN SELECT * FROM public.system_logs WHERE id = ANY(v_pend) ORDER BY created_at LOOP
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id::text = $1)', r.table_name) INTO v_existe USING r.record_id;
      IF v_existe THEN
        UPDATE public.system_logs SET restaurado_em=now(), restaurado_por=auth.uid() WHERE id=r.id;
        CONTINUE;
      END IF;
      BEGIN
        EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)', r.table_name, r.table_name) USING r.old_data;
        UPDATE public.system_logs SET restaurado_em=now(), restaurado_por=auth.uid() WHERE id=r.id;
        v_ok := v_ok + 1; v_progresso := true;
      EXCEPTION WHEN OTHERS THEN
        v_prox := v_prox || r.id;
        v_ultimo_erro := v_ultimo_erro || jsonb_build_object(r.id::text, SQLERRM);
      END;
    END LOOP;
    v_pend := v_prox;
    EXIT WHEN NOT v_progresso;
  END LOOP;
  IF v_pend IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('log_id',id,'tabela',table_name,'erro',v_ultimo_erro->>id::text)),'[]') INTO v_erros
      FROM public.system_logs WHERE id = ANY(v_pend);
  END IF;
  RETURN jsonb_build_object('restaurados',v_ok,'falhas',v_erros);
END; $$;
REVOKE ALL ON FUNCTION public.system_logs_restaurar(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.system_logs_restaurar(uuid[]) TO authenticated;