ALTER TABLE public.certificacoes ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS certificacoes_sale_id_uniq ON public.certificacoes(sale_id) WHERE sale_id IS NOT NULL;

INSERT INTO public.certificacoes (user_id, sale_id, aluno_id, nome, email, telefone, cpf, nivel_ensino, curso, vendedor_id, status, data_solicitacao, prazo_previsto, previsao_certificacao)
SELECT s.user_id,
       s.id,
       st.id,
       s.student_name,
       st.email,
       st.phone,
       st.cpf,
       s.course_levels[1],
       s.course,
       s.vendedor_id,
       'pendente_documentos',
       s.date,
       s.previsao_conclusao,
       s.previsao_conclusao
FROM public.sales s
LEFT JOIN LATERAL (
  SELECT id, email, phone, cpf FROM public.students
  WHERE lower(trim(full_name)) = lower(trim(s.student_name))
  LIMIT 1
) st ON true
WHERE s.previsao_conclusao IS NOT NULL
  AND s.status <> 'cancelada'
  AND NOT EXISTS (SELECT 1 FROM public.certificacoes c WHERE c.sale_id = s.id);