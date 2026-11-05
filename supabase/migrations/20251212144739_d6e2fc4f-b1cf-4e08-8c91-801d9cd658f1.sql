-- Create table for paid traffic campaigns
CREATE TABLE public.campanhas_trafego (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  data DATE NOT NULL,
  valor_gasto NUMERIC NOT NULL,
  leads INTEGER NOT NULL DEFAULT 0,
  alunos_convertidos INTEGER NOT NULL DEFAULT 0,
  plataforma TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.campanhas_trafego ENABLE ROW LEVEL SECURITY;

-- Create policies for collaborative access (all authenticated users see all data)
CREATE POLICY "Authenticated users can view all campanhas_trafego" 
ON public.campanhas_trafego 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert campanhas_trafego" 
ON public.campanhas_trafego 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update all campanhas_trafego" 
ON public.campanhas_trafego 
FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete all campanhas_trafego" 
ON public.campanhas_trafego 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_campanhas_trafego_updated_at
BEFORE UPDATE ON public.campanhas_trafego
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();