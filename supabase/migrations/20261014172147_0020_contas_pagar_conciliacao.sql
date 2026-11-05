ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS conciliado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conciliado_em timestamptz,
  ADD COLUMN IF NOT EXISTS conciliado_por uuid;
COMMENT ON COLUMN public.contas_pagar.conciliado IS 'Conferido contra o extrato bancário no relatório de Contas a Pagar';