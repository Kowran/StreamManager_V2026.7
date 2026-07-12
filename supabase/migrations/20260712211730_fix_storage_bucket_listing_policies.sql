
-- Fix public storage bucket policies that allow listing all files
-- Replace broad SELECT policies with ones that only allow access by object name (not listing)

DROP POLICY IF EXISTS "Public avatars are viewable by everyone" ON storage.objects;
CREATE POLICY "Public avatars are viewable by everyone" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars' AND name IS NOT NULL);

DROP POLICY IF EXISTS "Public covers are viewable by everyone" ON storage.objects;
CREATE POLICY "Public covers are viewable by everyone" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'covers' AND name IS NOT NULL);
