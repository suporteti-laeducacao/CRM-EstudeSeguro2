-- Fix the last USING(true) policy - lead_messages INSERT
-- This table receives data from the sync edge function which uses service role
-- So we need to allow insert only for privileged roles or match with existing lead ownership

DROP POLICY IF EXISTS "System can insert lead_messages" ON public.lead_messages;

-- Create a proper insert policy that checks if the user has access to the lead
CREATE POLICY "Privileged can insert lead_messages"
ON public.lead_messages FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role) OR
  has_role(auth.uid(), 'supervisor'::app_role)
);