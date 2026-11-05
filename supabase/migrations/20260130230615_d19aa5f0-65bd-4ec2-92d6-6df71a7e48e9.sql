-- Add status field to sales table for cancellation tracking
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativa';

-- Add comment for documentation
COMMENT ON COLUMN public.sales.status IS 'Status da venda: ativa, cancelada';