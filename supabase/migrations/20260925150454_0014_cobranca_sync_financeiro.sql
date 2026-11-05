CREATE OR REPLACE FUNCTION public.cobranca_on_installment_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_cob record;
BEGIN
  FOR v_cob IN SELECT id FROM public.cobrancas WHERE sale_id = NEW.sale_id AND situacao = 'ativa' LOOP
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('paid','refunded') THEN
      PERFORM public.cobranca_log(v_cob.id, 'pagamento',
        CASE WHEN NEW.status='paid' THEN 'Pagamento registrado através do módulo Financeiro.' ELSE 'Parcela estornada no módulo Financeiro.' END
        || ' (Parcela ' || NEW.installment_number || ', venc. ' || to_char(NEW.due_date,'DD/MM/YYYY') || ')',
        jsonb_build_object('parcela_id', NEW.id, 'status', NEW.status, 'valor_pago', NEW.paid_amount), false);
      -- cancela ações futuras ligadas exclusivamente à parcela quitada
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
END; $function$;

REVOKE EXECUTE ON FUNCTION public.cobranca_on_installment_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_cobranca_installment_sync ON public.installments;
CREATE TRIGGER trg_cobranca_installment_sync AFTER UPDATE OF status, due_date, value ON public.installments
FOR EACH ROW EXECUTE FUNCTION public.cobranca_on_installment_change();