ALTER TABLE public.collection_attempts
  ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resultado text NOT NULL DEFAULT 'sem_resposta',
  ADD COLUMN IF NOT EXISTS promessa_pagamento_em date,
  ADD COLUMN IF NOT EXISTS valor_prometido numeric,
  ADD COLUMN IF NOT EXISTS proximo_contato_em date,
  ADD COLUMN IF NOT EXISTS responsavel_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_collection_attempts_installment ON public.collection_attempts(installment_id);
CREATE INDEX IF NOT EXISTS idx_collection_attempts_sale ON public.collection_attempts(sale_id);
CREATE INDEX IF NOT EXISTS idx_collection_attempts_proximo ON public.collection_attempts(proximo_contato_em);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_attempts TO authenticated;
GRANT ALL ON public.collection_attempts TO service_role;
REVOKE ALL ON public.collection_attempts FROM anon;

DROP POLICY IF EXISTS "Privileged can view collection_attempts" ON public.collection_attempts;
DROP POLICY IF EXISTS "Privileged can insert collection_attempts" ON public.collection_attempts;
DROP POLICY IF EXISTS "Privileged can update collection_attempts" ON public.collection_attempts;
DROP POLICY IF EXISTS "Privileged can delete collection_attempts" ON public.collection_attempts;

CREATE POLICY "Cobranca view" ON public.collection_attempts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "Cobranca insert" ON public.collection_attempts FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'gerente')));
CREATE POLICY "Cobranca update" ON public.collection_attempts FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'gerente'));
CREATE POLICY "Cobranca delete" ON public.collection_attempts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS trg_collection_attempts_updated_at ON public.collection_attempts;
CREATE TRIGGER trg_collection_attempts_updated_at BEFORE UPDATE ON public.collection_attempts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();