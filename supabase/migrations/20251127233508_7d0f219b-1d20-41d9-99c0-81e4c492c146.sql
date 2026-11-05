-- Create cursos table for dynamic course management
CREATE TABLE public.cursos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;

-- Create policies for all authenticated users to access all cursos
CREATE POLICY "All authenticated users can view all cursos"
ON public.cursos
FOR SELECT
USING (true);

CREATE POLICY "All authenticated users can create cursos"
ON public.cursos
FOR INSERT
WITH CHECK (true);

CREATE POLICY "All authenticated users can update cursos"
ON public.cursos
FOR UPDATE
USING (true);

CREATE POLICY "All authenticated users can delete cursos"
ON public.cursos
FOR DELETE
USING (true);