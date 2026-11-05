
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS down_payment_counts_in_original boolean DEFAULT true;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS down_payment_counts_in_company boolean DEFAULT true;
