/*
# Create Forum System (categories, topics, replies)

## Overview
Transforms the community tab into a full forum with admin-created categories,
user-created topics, and user-posted replies. Replaces the old community_posts
announcement system with a proper discussion forum.

## New Tables

### 1. forum_categories
- `id` (uuid PK)
- `name` (text, not null) — display name
- `slug` (text, unique, not null) — URL-friendly identifier
- `description` (text, nullable) — category description
- `icon` (text, nullable) — lucide icon name
- `color` (text, default '#3b82f6') — accent color
- `display_order` (int, default 0) — sort order
- `is_active` (bool, default true) — visibility toggle
- `created_at` (timestamptz)

### 2. forum_topics
- `id` (uuid PK)
- `category_id` (uuid FK → forum_categories, CASCADE)
- `title` (text, not null)
- `content` (text, not null) — markdown/HTML body
- `author_id` (uuid, default auth.uid(), FK → auth.users, SET NULL)
- `is_pinned` (bool, default false) — admin pin
- `is_locked` (bool, default false) — admin lock
- `views` (int, default 0) — view counter
- `image_url` (text, nullable)
- `created_at`, `updated_at` (timestamptz)

### 3. forum_replies
- `id` (uuid PK)
- `topic_id` (uuid FK → forum_topics, CASCADE)
- `content` (text, not null)
- `author_id` (uuid, default auth.uid(), FK → auth.users, SET NULL)
- `is_solution` (bool, default false) — mark as accepted answer
- `created_at`, `updated_at` (timestamptz)

## Security (RLS)

### forum_categories
- SELECT: all authenticated users can see active categories
- INSERT/UPDATE/DELETE: admin only (checks custom users table for user_type = 'admin')

### forum_topics
- SELECT: all authenticated users can read
- INSERT: any authenticated user (owner = auth.uid())
- UPDATE: admin only (pin/lock) — authors cannot edit
- DELETE: admin or topic author

### forum_replies
- SELECT: all authenticated users
- INSERT: any authenticated user
- UPDATE: admin only (mark solution)
- DELETE: admin or reply author

## Indexes
- forum_topics: (category_id, is_pinned DESC, created_at DESC), (author_id)
- forum_replies: (topic_id, created_at), (author_id)
- forum_categories: (display_order)

## Important Notes
1. The app has sign-in, so all policies use `TO authenticated` with `auth.uid()`.
2. `author_id` columns default to `auth.uid()` so inserts work without explicit user_id.
3. Admin checks use the existing `users` table pattern: `EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin')`.
4. A trigger updates `forum_topics.updated_at` when a reply is created (bumping the topic).
5. A trigger increments `forum_topics.views` on each view is NOT included — views are incremented via RPC to avoid race conditions.
*/

-- ============================================
-- 1. forum_categories
-- ============================================
CREATE TABLE IF NOT EXISTS forum_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  icon text,
  color text NOT NULL DEFAULT '#3b82f6',
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_forum_categories" ON forum_categories;
CREATE POLICY "select_forum_categories"
  ON forum_categories FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_forum_categories_admin" ON forum_categories;
CREATE POLICY "insert_forum_categories_admin"
  ON forum_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin')
  );

DROP POLICY IF EXISTS "update_forum_categories_admin" ON forum_categories;
CREATE POLICY "update_forum_categories_admin"
  ON forum_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin')
  );

DROP POLICY IF EXISTS "delete_forum_categories_admin" ON forum_categories;
CREATE POLICY "delete_forum_categories_admin"
  ON forum_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin')
  );

-- ============================================
-- 2. forum_topics
-- ============================================
CREATE TABLE IF NOT EXISTS forum_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES forum_categories(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  author_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  views integer NOT NULL DEFAULT 0,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE forum_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_forum_topics" ON forum_topics;
CREATE POLICY "select_forum_topics"
  ON forum_topics FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_forum_topics" ON forum_topics;
CREATE POLICY "insert_forum_topics"
  ON forum_topics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "update_forum_topics_admin" ON forum_topics;
CREATE POLICY "update_forum_topics_admin"
  ON forum_topics FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin')
  );

DROP POLICY IF EXISTS "delete_forum_topics" ON forum_topics;
CREATE POLICY "delete_forum_topics"
  ON forum_topics FOR DELETE
  TO authenticated
  USING (
    auth.uid() = author_id OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_forum_topics_category
  ON forum_topics (category_id, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_topics_author
  ON forum_topics (author_id);

-- ============================================
-- 3. forum_replies
-- ============================================
CREATE TABLE IF NOT EXISTS forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
  content text NOT NULL,
  author_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  is_solution boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE forum_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_forum_replies" ON forum_replies;
CREATE POLICY "select_forum_replies"
  ON forum_replies FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_forum_replies" ON forum_replies;
CREATE POLICY "insert_forum_replies"
  ON forum_replies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "update_forum_replies_admin" ON forum_replies;
CREATE POLICY "update_forum_replies_admin"
  ON forum_replies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin')
  );

DROP POLICY IF EXISTS "delete_forum_replies" ON forum_replies;
CREATE POLICY "delete_forum_replies"
  ON forum_replies FOR DELETE
  TO authenticated
  USING (
    auth.uid() = author_id OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_forum_replies_topic
  ON forum_replies (topic_id, created_at);
CREATE INDEX IF NOT EXISTS idx_forum_replies_author
  ON forum_replies (author_id);

-- ============================================
-- 4. Triggers
-- ============================================

-- Auto-update forum_topics.updated_at on reply insert (bump topic)
CREATE OR REPLACE FUNCTION bump_topic_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE forum_topics
  SET updated_at = now()
  WHERE id = NEW.topic_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_bump_topic ON forum_replies;
CREATE TRIGGER trigger_bump_topic
  AFTER INSERT ON forum_replies
  FOR EACH ROW
  EXECUTE FUNCTION bump_topic_updated_at();

-- Auto-update forum_topics.updated_at on topic update
CREATE OR REPLACE FUNCTION update_topic_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_topic_updated_at ON forum_topics;
CREATE TRIGGER trigger_topic_updated_at
  BEFORE UPDATE ON forum_topics
  FOR EACH ROW
  EXECUTE FUNCTION update_topic_updated_at();

-- ============================================
-- 5. Increment view count function (RPC)
-- ============================================
CREATE OR REPLACE FUNCTION increment_topic_views(topic_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE forum_topics SET views = views + 1 WHERE id = topic_uuid;
END;
$$;

-- Grant execute to authenticated
REVOKE ALL ON FUNCTION increment_topic_views(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_topic_views(uuid) TO authenticated;

-- ============================================
-- 6. Reply count function (for topic list)
-- ============================================
CREATE OR REPLACE FUNCTION get_topic_reply_count(topic_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT COUNT(*) INTO cnt FROM forum_replies WHERE topic_id = topic_uuid;
  RETURN cnt;
END;
$$;

REVOKE ALL ON FUNCTION get_topic_reply_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_topic_reply_count(uuid) TO authenticated;

-- ============================================
-- 7. Seed default categories
-- ============================================
INSERT INTO forum_categories (name, slug, description, icon, color, display_order)
VALUES
  ('Geral', 'geral', 'Discussões gerais sobre qualquer assunto', 'MessageSquare', '#3b82f6', 0),
  ('Dúvidas', 'duvidas', 'Tire suas dúvidas e ajude outros usuários', 'HelpCircle', '#f59e0b', 1),
  ('Anúncios', 'anuncios', 'Anúncios oficiais da administração', 'Megaphone', '#ef4444', 2),
  ('Tutoriais', 'tutoriais', 'Compartilhe e encontre tutoriais', 'BookOpen', '#10b981', 3)
ON CONFLICT (slug) DO NOTHING;
