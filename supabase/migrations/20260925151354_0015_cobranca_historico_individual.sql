CREATE OR REPLACE FUNCTION public.cobranca_historico(_cobranca uuid)
RETURNS SETOF public.cobranca_eventos
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_access_cobranca(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY SELECT * FROM public.cobranca_eventos WHERE cobranca_id = _cobranca ORDER BY created_at DESC;
END; $$;
REVOKE ALL ON FUNCTION public.cobranca_historico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cobranca_historico(uuid) TO authenticated;

DROP POLICY IF EXISTS "Eventos view" ON public.cobranca_eventos;
CREATE POLICY "Eventos view" ON public.cobranca_eventos FOR SELECT TO authenticated
USING (public.can_view_cobranca_historico_geral(auth.uid()));