-- Update RLS policies to allow all authenticated users to view all data

-- Drop existing restrictive policies for clientes
DROP POLICY IF EXISTS "Users can view their own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Users can insert their own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Users can update their own clientes" ON public.clientes;
DROP POLICY IF EXISTS "Users can delete their own clientes" ON public.clientes;

-- Create new policies for clientes allowing all authenticated users
CREATE POLICY "Authenticated users can view all clientes" 
ON public.clientes 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert clientes" 
ON public.clientes 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update all clientes" 
ON public.clientes 
FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete all clientes" 
ON public.clientes 
FOR DELETE 
USING (true);

-- Drop existing restrictive policies for negocios
DROP POLICY IF EXISTS "Users can view their own negocios" ON public.negocios;
DROP POLICY IF EXISTS "Users can insert their own negocios" ON public.negocios;
DROP POLICY IF EXISTS "Users can update their own negocios" ON public.negocios;
DROP POLICY IF EXISTS "Users can delete their own negocios" ON public.negocios;

-- Create new policies for negocios allowing all authenticated users
CREATE POLICY "Authenticated users can view all negocios" 
ON public.negocios 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert negocios" 
ON public.negocios 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update all negocios" 
ON public.negocios 
FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete all negocios" 
ON public.negocios 
FOR DELETE 
USING (true);

-- Drop existing restrictive policies for atividades
DROP POLICY IF EXISTS "Users can view their own atividades" ON public.atividades;
DROP POLICY IF EXISTS "Users can insert their own atividades" ON public.atividades;
DROP POLICY IF EXISTS "Users can update their own atividades" ON public.atividades;
DROP POLICY IF EXISTS "Users can delete their own atividades" ON public.atividades;

-- Create new policies for atividades allowing all authenticated users
CREATE POLICY "Authenticated users can view all atividades" 
ON public.atividades 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert atividades" 
ON public.atividades 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update all atividades" 
ON public.atividades 
FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete all atividades" 
ON public.atividades 
FOR DELETE 
USING (true);