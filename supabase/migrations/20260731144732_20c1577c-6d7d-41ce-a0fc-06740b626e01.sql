CREATE TABLE public.ranking_exclusions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  reference_type text NOT NULL CHECK (reference_type IN ('payment','installment')),
  reference_id uuid NOT NULL,
  motivo text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (reference_type, reference_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ranking_exclusions TO authenticated;
GRANT ALL ON public.ranking_exclusions TO service_role;

ALTER TABLE public.ranking_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ranking exclusions"
ON public.ranking_exclusions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Privileged can create ranking exclusions"
ON public.ranking_exclusions FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id AND (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gerente') OR
    public.has_role(auth.uid(), 'financeiro')
  )
);

CREATE POLICY "Privileged can delete ranking exclusions"
ON public.ranking_exclusions FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'gerente') OR
  public.has_role(auth.uid(), 'financeiro')
);