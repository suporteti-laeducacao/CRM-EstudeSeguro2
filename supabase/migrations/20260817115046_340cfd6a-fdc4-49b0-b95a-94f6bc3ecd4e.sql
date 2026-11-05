ALTER TABLE public.categorias_conta ADD COLUMN IF NOT EXISTS custo_operacional boolean NOT NULL DEFAULT false;

UPDATE public.categorias_conta SET custo_operacional = true WHERE nome IN ('Benefícios','FGTS','DARF');

INSERT INTO public.categorias_conta (user_id, nome, ativo, custo_operacional)
SELECT (SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1), v.nome, false, v.co
FROM (VALUES
  ('comissao', true),
  ('salario', true),
  ('vale', true),
  ('despesa_fixa', false),
  ('despesa_variavel', false),
  ('fornecedor', false),
  ('outros', false)
) AS v(nome, co)
WHERE NOT EXISTS (SELECT 1 FROM public.categorias_conta c WHERE c.nome = v.nome)
  AND EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin');