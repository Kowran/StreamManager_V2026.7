/*
  # Blog system (admin-authored news/articles)

  Replaces the community forum concept with a blog where admins publish
  news articles (game news, updates, etc.) and users read them.

  1. New Table
    - blog_posts
      - id, title, slug, excerpt, content, image_url, category, tags,
        author_id, is_published, is_featured, views, created_at, updated_at

  2. Security (RLS)
    - Published posts: readable by everyone (anon + authenticated)
    - Unpublished posts: readable only by the author or admins
    - INSERT / UPDATE / DELETE: admins only (role = 'admin' in profiles)

  3. Helper
    - increment_blog_views() function to count views safely
*/

CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE NOT NULL,
  excerpt text,
  content text NOT NULL,
  image_url text,
  category text DEFAULT 'Notícias' NOT NULL,
  tags text[] DEFAULT '{}',
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_published boolean DEFAULT false NOT NULL,
  is_featured boolean DEFAULT false NOT NULL,
  views integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_featured ON blog_posts(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);

-- Enable RLS
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- SELECT: published posts visible to everyone; unpublished only to author or admin
CREATE POLICY "blog_posts_public_read"
  ON blog_posts FOR SELECT
  TO anon, authenticated
  USING (
    is_published = true
    OR author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- INSERT: admins only
CREATE POLICY "blog_posts_admin_insert"
  ON blog_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- UPDATE: admins only
CREATE POLICY "blog_posts_admin_update"
  ON blog_posts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- DELETE: admins only
CREATE POLICY "blog_posts_admin_delete"
  ON blog_posts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_blog_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_blog_posts_updated_at ON blog_posts;
CREATE TRIGGER trigger_update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_blog_posts_updated_at();

-- View increment function
CREATE OR REPLACE FUNCTION public.increment_blog_views(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE blog_posts SET views = views + 1 WHERE id = p_post_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_blog_views(uuid) TO anon, authenticated;
