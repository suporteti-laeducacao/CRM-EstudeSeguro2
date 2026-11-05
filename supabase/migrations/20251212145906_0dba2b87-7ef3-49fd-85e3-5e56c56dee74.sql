-- Add categoria column to campanhas_trafego
ALTER TABLE public.campanhas_trafego 
ADD COLUMN categoria text NOT NULL DEFAULT 'eja';

-- Add comment for clarity
COMMENT ON COLUMN public.campanhas_trafego.categoria IS 'Tipo de curso: eja, tecnico, pos_tecnico, bacharelado, tecnologo';