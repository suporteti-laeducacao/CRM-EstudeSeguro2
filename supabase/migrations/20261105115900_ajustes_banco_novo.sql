-- O app grava esta coluna ao salvar toda venda, mas nenhuma migration a criava.
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS boleto_gerado boolean DEFAULT false;

-- As migrations registram seus proprios dados iniciais no log: o banco do cliente comeca sem historico.
DELETE FROM public.system_logs;
