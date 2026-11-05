ALTER TABLE public.clientes 
  ADD COLUMN IF NOT EXISTS nivel_ensino text,
  ADD COLUMN IF NOT EXISTS curso text,
  ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES public.vendedores(id);

ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS follow_ups jsonb NOT NULL DEFAULT '[]'::jsonb;