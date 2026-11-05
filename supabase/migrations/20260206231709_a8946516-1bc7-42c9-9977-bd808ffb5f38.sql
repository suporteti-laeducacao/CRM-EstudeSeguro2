-- Add columns for partial payment tracking in contas_pagar
ALTER TABLE public.contas_pagar 
ADD COLUMN IF NOT EXISTS valor_pago numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_total numeric;