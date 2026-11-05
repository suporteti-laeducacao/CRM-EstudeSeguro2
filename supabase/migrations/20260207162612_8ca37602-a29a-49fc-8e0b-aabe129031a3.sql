-- Remove the check constraint that restricts categoria to predefined values
-- This allows custom categories to be saved
ALTER TABLE public.contas_pagar DROP CONSTRAINT IF EXISTS contas_pagar_categoria_check;