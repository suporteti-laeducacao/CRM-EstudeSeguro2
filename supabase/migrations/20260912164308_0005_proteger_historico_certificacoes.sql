
-- 1) Histórico nunca pode ser apagado: troca CASCADE por RESTRICT
ALTER TABLE public.certificacoes_historico
  DROP CONSTRAINT IF EXISTS certificacoes_historico_certificacao_id_fkey;

ALTER TABLE public.certificacoes_historico
  ADD CONSTRAINT certificacoes_historico_certificacao_id_fkey
  FOREIGN KEY (certificacao_id) REFERENCES public.certificacoes(id) ON DELETE RESTRICT;

-- 2) Ninguém exclui certificação via API: sem grant e sem policy de DELETE
DROP POLICY IF EXISTS "Users can delete certificacoes based on role" ON public.certificacoes;
REVOKE DELETE ON public.certificacoes FROM authenticated;
REVOKE DELETE ON public.certificacoes FROM anon;

-- 3) Trigger registra o motivo do cancelamento no histórico
CREATE OR REPLACE FUNCTION public.log_certificacao_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.certificacoes_historico (certificacao_id, status_anterior, status_novo, usuario_id)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.certificacoes_historico (certificacao_id, status_anterior, status_novo, usuario_id, observacao)
    VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      CASE
        WHEN NEW.status = 'cancelada' AND NEW.motivo_cancelamento IS NOT NULL AND NEW.motivo_cancelamento <> ''
          THEN 'Motivo do cancelamento: ' || NEW.motivo_cancelamento
        ELSE NULL
      END
    );
  END IF;
  RETURN NEW;
END;
$$;
