ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS campanha_id uuid REFERENCES public.campanhas_trafego(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_campanha_id ON public.sales(campanha_id);

DROP POLICY IF EXISTS "Authenticated can view campanhas_trafego" ON public.campanhas_trafego;
CREATE POLICY "Authenticated can view campanhas_trafego"
ON public.campanhas_trafego
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);