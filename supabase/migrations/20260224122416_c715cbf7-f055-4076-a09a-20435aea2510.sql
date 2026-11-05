
-- Create storage bucket for boletos
INSERT INTO storage.buckets (id, name, public) VALUES ('boletos', 'boletos', false);

-- RLS policies for boletos bucket
CREATE POLICY "Admins e Gerentes podem fazer upload de boletos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'boletos' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role))
);

CREATE POLICY "Admins e Gerentes podem ver boletos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'boletos' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role))
);

CREATE POLICY "Admins e Gerentes podem deletar boletos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'boletos' AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gerente'::app_role))
);
