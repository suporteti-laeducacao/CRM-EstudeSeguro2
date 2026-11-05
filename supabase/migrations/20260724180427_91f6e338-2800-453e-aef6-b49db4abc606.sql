-- Allow vendedores to insert, update and view students so that sale data (address, CPF, birth date) syncs correctly
DROP POLICY IF EXISTS "Privileged can view students" ON public.students;
DROP POLICY IF EXISTS "Privileged can insert students" ON public.students;
DROP POLICY IF EXISTS "Privileged can update students" ON public.students;

CREATE POLICY "Authenticated can view students"
  ON public.students FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert students"
  ON public.students FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update students"
  ON public.students FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
