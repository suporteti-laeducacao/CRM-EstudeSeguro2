-- =========================
-- contas_pagar: financeiro full access
-- =========================
DROP POLICY IF EXISTS "Admins e Gerentes podem ver contas_pagar" ON public.contas_pagar;
CREATE POLICY "Privileged can view contas_pagar" ON public.contas_pagar
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Admins e Gerentes podem inserir contas_pagar" ON public.contas_pagar;
CREATE POLICY "Privileged can insert contas_pagar" ON public.contas_pagar
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Admins e Gerentes podem atualizar contas_pagar" ON public.contas_pagar;
CREATE POLICY "Privileged can update contas_pagar" ON public.contas_pagar
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Admins e Gerentes podem deletar contas_pagar" ON public.contas_pagar;
CREATE POLICY "Privileged can delete contas_pagar" ON public.contas_pagar
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

-- =========================
-- credores
-- =========================
DROP POLICY IF EXISTS "Admins e Gerentes podem ver credores" ON public.credores;
CREATE POLICY "Privileged can view credores" ON public.credores
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Admins e Gerentes podem inserir credores" ON public.credores;
CREATE POLICY "Privileged can insert credores" ON public.credores
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Admins e Gerentes podem atualizar credores" ON public.credores;
CREATE POLICY "Privileged can update credores" ON public.credores
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Admins e Gerentes podem deletar credores" ON public.credores;
CREATE POLICY "Privileged can delete credores" ON public.credores
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

-- =========================
-- recorrencias
-- =========================
DROP POLICY IF EXISTS "Admins e Gerentes podem ver recorrencias" ON public.recorrencias;
CREATE POLICY "Privileged can view recorrencias" ON public.recorrencias
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Admins e Gerentes podem inserir recorrencias" ON public.recorrencias;
CREATE POLICY "Privileged can insert recorrencias" ON public.recorrencias
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Admins e Gerentes podem atualizar recorrencias" ON public.recorrencias;
CREATE POLICY "Privileged can update recorrencias" ON public.recorrencias
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Admins e Gerentes podem deletar recorrencias" ON public.recorrencias;
CREATE POLICY "Privileged can delete recorrencias" ON public.recorrencias
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

-- =========================
-- categorias_conta
-- =========================
DROP POLICY IF EXISTS "Admins e Gerentes podem ver categorias" ON public.categorias_conta;
CREATE POLICY "Privileged can view categorias" ON public.categorias_conta
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Admins e Gerentes podem inserir categorias" ON public.categorias_conta;
CREATE POLICY "Privileged can insert categorias" ON public.categorias_conta
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Admins e Gerentes podem atualizar categorias" ON public.categorias_conta;
CREATE POLICY "Privileged can update categorias" ON public.categorias_conta
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Admins e Gerentes podem deletar categorias" ON public.categorias_conta;
CREATE POLICY "Privileged can delete categorias" ON public.categorias_conta
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

-- =========================
-- sales: financeiro can view + edit all
-- =========================
DROP POLICY IF EXISTS "Users can view sales based on role" ON public.sales;
CREATE POLICY "Users can view sales based on role" ON public.sales
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR (user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update sales based on role" ON public.sales;
CREATE POLICY "Users can update sales based on role" ON public.sales
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR (user_id = auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR (user_id = auth.uid()));

-- =========================
-- installments: financeiro view + update
-- =========================
DROP POLICY IF EXISTS "Users can view installments based on role" ON public.installments;
CREATE POLICY "Users can view installments based on role" ON public.installments
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR (user_id = auth.uid()));

DROP POLICY IF EXISTS "Privileged can update installments" ON public.installments;
CREATE POLICY "Privileged can update installments" ON public.installments
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR (user_id = auth.uid()));

DROP POLICY IF EXISTS "Privileged can insert installments" ON public.installments;
CREATE POLICY "Privileged can insert installments" ON public.installments
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR (user_id = auth.uid()));

-- =========================
-- installment_payments
-- =========================
DROP POLICY IF EXISTS "Privileged can view installment_payments" ON public.installment_payments;
CREATE POLICY "Privileged can view installment_payments" ON public.installment_payments
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR (user_id = auth.uid()));

DROP POLICY IF EXISTS "Privileged can insert installment_payments" ON public.installment_payments;
CREATE POLICY "Privileged can insert installment_payments" ON public.installment_payments
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR (user_id = auth.uid()));

-- =========================
-- installment_change_logs
-- =========================
DROP POLICY IF EXISTS "Privileged can view installment_change_logs" ON public.installment_change_logs;
CREATE POLICY "Privileged can view installment_change_logs" ON public.installment_change_logs
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR (user_id = auth.uid()));

-- =========================
-- sale_change_logs
-- =========================
DROP POLICY IF EXISTS "Privileged can view sale_change_logs" ON public.sale_change_logs;
CREATE POLICY "Privileged can view sale_change_logs" ON public.sale_change_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role) OR (user_id = auth.uid()));

-- =========================
-- students: financeiro full
-- =========================
DROP POLICY IF EXISTS "Privileged can view students" ON public.students;
CREATE POLICY "Privileged can view students" ON public.students
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Privileged can insert students" ON public.students;
CREATE POLICY "Privileged can insert students" ON public.students
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Privileged can update students" ON public.students;
CREATE POLICY "Privileged can update students" ON public.students
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Privileged can delete students" ON public.students;
CREATE POLICY "Privileged can delete students" ON public.students
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

-- =========================
-- negocios (previsão de vendas) - financeiro view
-- =========================
DROP POLICY IF EXISTS "Privileged can view all negocios" ON public.negocios;
CREATE POLICY "Privileged can view all negocios" ON public.negocios
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Privileged can insert negocios" ON public.negocios;
CREATE POLICY "Privileged can insert negocios" ON public.negocios
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Privileged can update all negocios" ON public.negocios;
CREATE POLICY "Privileged can update all negocios" ON public.negocios
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Privileged can delete all negocios" ON public.negocios;
CREATE POLICY "Privileged can delete all negocios" ON public.negocios
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

-- =========================
-- clientes
-- =========================
DROP POLICY IF EXISTS "Privileged can view clientes" ON public.clientes;
CREATE POLICY "Privileged can view clientes" ON public.clientes
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

-- =========================
-- atividades
-- =========================
DROP POLICY IF EXISTS "Privileged can view atividades" ON public.atividades;
CREATE POLICY "Privileged can view atividades" ON public.atividades
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

-- =========================
-- campanhas / lancamentos (relatórios) - financeiro can view
-- =========================
DROP POLICY IF EXISTS "Privileged can view campanhas_trafego" ON public.campanhas_trafego;
CREATE POLICY "Privileged can view campanhas_trafego" ON public.campanhas_trafego
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Privileged can view lancamentos_campanha" ON public.lancamentos_campanha;
CREATE POLICY "Privileged can view lancamentos_campanha" ON public.lancamentos_campanha
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

-- =========================
-- metas_gerais & metas_vendedores - financeiro can view
-- =========================
DROP POLICY IF EXISTS "Admins e Gerentes podem ver metas_gerais" ON public.metas_gerais;
CREATE POLICY "Privileged can view metas_gerais" ON public.metas_gerais
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Todos autenticados podem ver metas_vendedores" ON public.metas_vendedores;
CREATE POLICY "Privileged can view metas_vendedores" ON public.metas_vendedores
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'vendedor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

-- =========================
-- collection_attempts
-- =========================
DROP POLICY IF EXISTS "Privileged can view collection_attempts" ON public.collection_attempts;
CREATE POLICY "Privileged can view collection_attempts" ON public.collection_attempts
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Privileged can insert collection_attempts" ON public.collection_attempts;
CREATE POLICY "Privileged can insert collection_attempts" ON public.collection_attempts
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Privileged can update collection_attempts" ON public.collection_attempts;
CREATE POLICY "Privileged can update collection_attempts" ON public.collection_attempts
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Privileged can delete collection_attempts" ON public.collection_attempts;
CREATE POLICY "Privileged can delete collection_attempts" ON public.collection_attempts
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));