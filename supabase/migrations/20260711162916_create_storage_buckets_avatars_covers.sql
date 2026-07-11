/*
# Create storage buckets for avatars and cover images

1. Storage Buckets
   - `avatars`: stores user profile pictures (public, 2MB max, images only)
   - `covers`: stores user cover/banner images (public, 5MB max, images only)

2. Storage Policies
   - Authenticated users can upload to their own folder (user_id prefix)
   - Public read access on both buckets
   - Users can only update/delete their own files
*/

-- Create avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create covers bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'covers',
  'covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Avatars policies
DROP POLICY IF EXISTS "Public avatars are viewable by everyone" ON storage.objects;
CREATE POLICY "Public avatars are viewable by everyone"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Covers policies
DROP POLICY IF EXISTS "Public covers are viewable by everyone" ON storage.objects;
CREATE POLICY "Public covers are viewable by everyone"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'covers');

DROP POLICY IF EXISTS "Users can upload own cover" ON storage.objects;
CREATE POLICY "Users can upload own cover"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own cover" ON storage.objects;
CREATE POLICY "Users can update own cover"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own cover" ON storage.objects;
CREATE POLICY "Users can delete own cover"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'covers' AND (storage.foldername(name))[1] = auth.uid()::text);
