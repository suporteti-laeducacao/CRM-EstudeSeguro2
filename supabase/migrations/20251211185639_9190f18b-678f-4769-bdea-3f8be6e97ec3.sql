-- Adicionar campos para valor cheio e valor empresa na tabela installments
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS full_value numeric;
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS company_value numeric;
ALTER TABLE public.installments ADD COLUMN IF NOT EXISTS is_repasse boolean DEFAULT false;