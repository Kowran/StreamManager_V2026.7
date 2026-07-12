
-- Storage policies for support-images bucket
CREATE POLICY "Authenticated users can upload support images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-images');

CREATE POLICY "Support images are publicly viewable" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'support-images' AND name IS NOT NULL);
