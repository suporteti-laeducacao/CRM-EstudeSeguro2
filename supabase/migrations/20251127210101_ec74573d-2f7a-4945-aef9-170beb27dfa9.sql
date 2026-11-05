-- FASE 1: Corrigir RLS para Sistema Colaborativo
-- Remover políticas restritivas e criar políticas permissivas

-- Tabela SALES
DROP POLICY IF EXISTS "Users can view their own sales" ON sales;
DROP POLICY IF EXISTS "Users can insert their own sales" ON sales;
DROP POLICY IF EXISTS "Users can update their own sales" ON sales;
DROP POLICY IF EXISTS "Users can delete their own sales" ON sales;

CREATE POLICY "Authenticated users can view all sales" 
ON sales FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert sales" 
ON sales FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update all sales" 
ON sales FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete all sales" 
ON sales FOR DELETE TO authenticated USING (true);

-- Tabela STUDENTS
DROP POLICY IF EXISTS "Users can view their own students" ON students;
DROP POLICY IF EXISTS "Users can insert their own students" ON students;
DROP POLICY IF EXISTS "Users can update their own students" ON students;
DROP POLICY IF EXISTS "Users can delete their own students" ON students;

CREATE POLICY "Authenticated users can view all students" 
ON students FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert students" 
ON students FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update all students" 
ON students FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete all students" 
ON students FOR DELETE TO authenticated USING (true);

-- Tabela INSTALLMENTS
DROP POLICY IF EXISTS "Users can view their own installments" ON installments;
DROP POLICY IF EXISTS "Users can insert their own installments" ON installments;
DROP POLICY IF EXISTS "Users can update their own installments" ON installments;
DROP POLICY IF EXISTS "Users can delete their own installments" ON installments;

CREATE POLICY "Authenticated users can view all installments" 
ON installments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert installments" 
ON installments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update all installments" 
ON installments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete all installments" 
ON installments FOR DELETE TO authenticated USING (true);

-- Tabela COLLECTION_ATTEMPTS
DROP POLICY IF EXISTS "Users can view their own collection attempts" ON collection_attempts;
DROP POLICY IF EXISTS "Users can insert their own collection attempts" ON collection_attempts;
DROP POLICY IF EXISTS "Users can update their own collection attempts" ON collection_attempts;
DROP POLICY IF EXISTS "Users can delete their own collection attempts" ON collection_attempts;

CREATE POLICY "Authenticated users can view all collection attempts" 
ON collection_attempts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert collection attempts" 
ON collection_attempts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update all collection attempts" 
ON collection_attempts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete all collection attempts" 
ON collection_attempts FOR DELETE TO authenticated USING (true);

-- FASE 2: Criar Sistema de Vendedores

-- Criar tabela vendedores (user_id pode ser qualquer UUID, não precisa ser do auth.users)
CREATE TABLE IF NOT EXISTS public.vendedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS para vendedores
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;

-- Políticas RLS permissivas para sistema colaborativo
CREATE POLICY "Authenticated users can view all vendedores" 
ON vendedores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert vendedores" 
ON vendedores FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update all vendedores" 
ON vendedores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete all vendedores" 
ON vendedores FOR DELETE TO authenticated USING (true);

-- Criar trigger para atualizar updated_at
CREATE TRIGGER update_vendedores_updated_at
BEFORE UPDATE ON public.vendedores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar coluna vendedor_id na tabela sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES vendedores(id);

