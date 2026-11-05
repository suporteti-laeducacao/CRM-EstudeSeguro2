-- Create clientes table
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  email TEXT UNIQUE,
  telefone TEXT,
  empresa TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on clientes
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- RLS policies for clientes
CREATE POLICY "Users can view their own clientes"
ON public.clientes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clientes"
ON public.clientes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clientes"
ON public.clientes
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clientes"
ON public.clientes
FOR DELETE
USING (auth.uid() = user_id);

-- Create negocios table
CREATE TABLE public.negocios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  valor NUMERIC,
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'em_andamento', 'fechado', 'perdido')),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on negocios
ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;

-- RLS policies for negocios
CREATE POLICY "Users can view their own negocios"
ON public.negocios
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own negocios"
ON public.negocios
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own negocios"
ON public.negocios
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own negocios"
ON public.negocios
FOR DELETE
USING (auth.uid() = user_id);

-- Create atividades table
CREATE TABLE public.atividades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ligacao', 'email', 'reuniao', 'tarefa')),
  descricao TEXT,
  data TIMESTAMP WITH TIME ZONE,
  negocio_id UUID REFERENCES public.negocios(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on atividades
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;

-- RLS policies for atividades
CREATE POLICY "Users can view their own atividades"
ON public.atividades
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own atividades"
ON public.atividades
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own atividades"
ON public.atividades
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own atividades"
ON public.atividades
FOR DELETE
USING (auth.uid() = user_id);