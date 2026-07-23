-- Add FK from blog_posts.author_id to profiles.id so that
-- PostgREST embedded joins (author:profiles(...)) resolve correctly.
-- The existing FK references auth.users(id), which PostgREST cannot
-- use for a relationship to the profiles table.

-- First drop the existing FK to auth.users
ALTER TABLE blog_posts DROP CONSTRAINT IF EXISTS blog_posts_author_id_fkey;

-- Add FK to profiles.id (ON DELETE CASCADE keeps original behavior)
ALTER TABLE blog_posts
  ADD CONSTRAINT blog_posts_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE CASCADE;
