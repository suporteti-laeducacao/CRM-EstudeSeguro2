ALTER TABLE public.sales 
  ADD COLUMN IF NOT EXISTS nf_emitida boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nf_emitida_at timestamp with time zone;