/*
# Create product-images storage bucket

1. New Storage Bucket
   - `product-images` — public read, authenticated write
   - File size limit: 5MB
   - Allowed MIME types: image/png, image/jpeg, image/webp, image/gif

2. Security (storage.objects RLS)
   - Public SELECT: anyone can view product images
   - Authenticated INSERT: any logged-in user can upload (seller creates product)
   - Authenticated UPDATE/DELETE: owner can manage their own uploads
     (uses the object's owner column which Supabase sets to auth.uid() on upload)
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "Public product images are viewable by everyone" ON storage.objects;
CREATE POLICY "Public product images are viewable by everyone"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images');

-- Authenticated upload
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- Owner can update
DROP POLICY IF EXISTS "Users can update own product images" ON storage.objects;
CREATE POLICY "Users can update own product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'product-images' AND owner = auth.uid());

-- Owner can delete
DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;
CREATE POLICY "Users can delete own product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND owner = auth.uid());
