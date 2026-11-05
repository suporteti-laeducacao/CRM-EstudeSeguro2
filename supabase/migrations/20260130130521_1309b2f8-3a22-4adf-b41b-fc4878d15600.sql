-- Add foto_url column to vendedores table
ALTER TABLE public.vendedores ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Create storage bucket for user profile photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-photos', 'user-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read all photos (public bucket)
CREATE POLICY "Public read access for user photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-photos');

-- Allow admins to upload/update user photos
CREATE POLICY "Admins can upload user photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-photos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can update user photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-photos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete user photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-photos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);