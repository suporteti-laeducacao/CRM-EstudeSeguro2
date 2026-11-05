-- Add vendedor_id and telefone to negocios table
ALTER TABLE public.negocios 
ADD COLUMN vendedor_id uuid REFERENCES public.vendedores(id),
ADD COLUMN telefone text;

-- Add comment for clarity
COMMENT ON COLUMN public.negocios.vendedor_id IS 'Foreign key to vendedores table';
COMMENT ON COLUMN public.negocios.telefone IS 'Contact phone number for the deal';