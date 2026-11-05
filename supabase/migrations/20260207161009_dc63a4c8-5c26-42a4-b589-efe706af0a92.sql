-- Remove the check constraint that prevents valor from being 0 (needed for fully paid accounts)
ALTER TABLE public.contas_pagar DROP CONSTRAINT IF EXISTS contas_pagar_valor_check;

-- Add a new constraint that allows 0 but prevents negative values
ALTER TABLE public.contas_pagar ADD CONSTRAINT contas_pagar_valor_check CHECK (valor >= 0);