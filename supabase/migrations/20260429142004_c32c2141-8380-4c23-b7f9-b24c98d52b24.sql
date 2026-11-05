-- Function to check if a phone number already exists in leads (any vendedor),
-- returning the existing lead's nome and the responsible vendedor name.
-- SECURITY DEFINER so vendedores can detect duplicates owned by other sellers.
CREATE OR REPLACE FUNCTION public.check_lead_telefone_duplicado(
  _telefone text,
  _exclude_lead_id uuid DEFAULT NULL
)
RETURNS TABLE (
  lead_id uuid,
  lead_nome text,
  vendedor_nome text,
  arquivado boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id AS lead_id,
    l.nome AS lead_nome,
    COALESCE(v.nome, 'Sem vendedor') AS vendedor_nome,
    l.arquivado
  FROM public.leads l
  LEFT JOIN public.vendedores v ON v.id = l.vendedor_id
  WHERE regexp_replace(COALESCE(l.telefone, ''), '\D', '', 'g') = regexp_replace(COALESCE(_telefone, ''), '\D', '', 'g')
    AND regexp_replace(COALESCE(_telefone, ''), '\D', '', 'g') <> ''
    AND (_exclude_lead_id IS NULL OR l.id <> _exclude_lead_id)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.check_lead_telefone_duplicado(text, uuid) TO authenticated;