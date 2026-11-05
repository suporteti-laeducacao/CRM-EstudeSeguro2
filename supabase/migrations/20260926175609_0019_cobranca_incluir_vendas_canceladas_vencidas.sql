CREATE OR REPLACE FUNCTION public.cobranca_sincronizar()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record; v_id uuid; v_n integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_access_cobranca(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501';
  END IF;
  -- Venda ativa com qualquer parcela em aberto, ou venda cancelada com parcela vencida ainda em aberto.
  FOR r IN
    SELECT DISTINCT s.id AS sale_id, s.student_name
    FROM public.sales s JOIN public.installments i ON i.sale_id = s.id
    WHERE i.status IN ('pending','due_today','overdue')
      AND (s.status = 'ativa' OR (s.status = 'cancelada' AND i.due_date < public.cobranca_hoje()))
      AND NOT EXISTS (SELECT 1 FROM public.cobrancas c WHERE c.sale_id = s.id AND c.situacao IN ('ativa','monitoramento'))
  LOOP
    SELECT id INTO v_id FROM public.cobrancas WHERE sale_id=r.sale_id AND situacao='encerrada' AND motivo_encerramento='pagamento'
      ORDER BY created_at DESC LIMIT 1;
    IF v_id IS NOT NULL THEN
      UPDATE public.cobrancas SET situacao='ativa', encerrada_em=NULL, motivo_encerramento=NULL WHERE id=v_id;
      PERFORM public.cobranca_log(v_id,'reativacao_automatica','Nova parcela em aberto — cobrança reativada.',NULL,true);
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

SELECT public.cobranca_sincronizar();