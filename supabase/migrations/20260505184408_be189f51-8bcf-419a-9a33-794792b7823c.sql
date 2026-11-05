-- Tabela de logs do sistema
CREATE TABLE public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_email text,
  table_name text NOT NULL,
  record_id text,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_logs_created_at ON public.system_logs (created_at DESC);
CREATE INDEX idx_system_logs_user_id ON public.system_logs (user_id);
CREATE INDEX idx_system_logs_table_name ON public.system_logs (table_name);
CREATE INDEX idx_system_logs_record_id ON public.system_logs (record_id);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem visualizar
CREATE POLICY "Admins can view system_logs"
ON public.system_logs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Ninguém pode atualizar nem deletar (imutável)
-- INSERT acontece via trigger SECURITY DEFINER

-- Função genérica de auditoria
CREATE OR REPLACE FUNCTION public.log_system_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_old jsonb;
  v_new jsonb;
  v_record_id text;
  v_changed text[];
  k text;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    v_record_id := COALESCE((v_old->>'id'), '');
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW);
    v_record_id := COALESCE((v_new->>'id'), '');
  ELSE -- UPDATE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := COALESCE((v_new->>'id'), '');
    
    -- calcular campos alterados
    v_changed := ARRAY[]::text[];
    FOR k IN SELECT jsonb_object_keys(v_new) LOOP
      IF (v_old->k) IS DISTINCT FROM (v_new->k) AND k NOT IN ('updated_at') THEN
        v_changed := array_append(v_changed, k);
      END IF;
    END LOOP;
    
    -- ignora updates apenas em updated_at
    IF array_length(v_changed, 1) IS NULL THEN
      RETURN COALESCE(NEW, OLD);
    END IF;
  END IF;

  INSERT INTO public.system_logs (
    user_id, user_email, table_name, record_id, action, old_data, new_data, changed_fields
  ) VALUES (
    v_user_id, v_user_email, TG_TABLE_NAME, v_record_id, TG_OP, v_old, v_new, v_changed
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar trigger em todas as tabelas relevantes
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'sales', 'installments', 'installment_payments', 'students',
    'leads', 'lead_tasks', 'lead_notes', 'lead_history',
    'contas_pagar', 'credores', 'recorrencias', 'categorias_conta',
    'cursos', 'grupos_repasse', 'vendedores', 'user_roles',
    'metas_gerais', 'metas_vendedores', 'campanhas_trafego', 'lancamentos_campanha',
    'negocios', 'clientes', 'collection_attempts', 'atividades'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_system_change()',
      t, t
    );
  END LOOP;
END $$;