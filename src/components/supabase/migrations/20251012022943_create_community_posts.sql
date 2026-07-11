/*
  # Create Community Posts System

  1. New Tables
    - `community_posts`
      - `id` (uuid, primary key)
      - `title` (text, required) - Post title
      - `content` (text, required) - Post content/body
      - `author_id` (uuid, foreign key to auth.users) - Admin who created the post
      - `image_url` (text, optional) - Optional image for the post
      - `is_pinned` (boolean, default false) - Pin important posts to top
      - `created_at` (timestamptz) - When post was created
      - `updated_at` (timestamptz) - When post was last updated
    
    - `community_post_reactions`
      - `id` (uuid, primary key)
      - `post_id` (uuid, foreign key to community_posts)
      - `user_id` (uuid, foreign key to auth.users)
      - `reaction_type` (text) - Type of reaction (like, love, etc)
      - `created_at` (timestamptz)
    
  2. Security
    - Enable RLS on all tables
    - Admins (user_type = 'admin') can create, update, delete posts
    - All authenticated users can view posts
    - Authenticated users can add reactions to posts
    
  3. Indexes
    - Index on created_at for sorting
    - Index on is_pinned for filtering
    - Index on post_id for reactions lookup
*/

-- Create community_posts table
CREATE TABLE IF NOT EXISTS community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  image_url text,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create community_post_reactions table
CREATE TABLE IF NOT EXISTS community_post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reaction_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id, reaction_type)
);

-- Enable RLS
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_post_reactions ENABLE ROW LEVEL SECURITY;

-- Policies for community_posts
CREATE POLICY "Anyone can view community posts"
  ON community_posts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert community posts"
  ON community_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  );

CREATE POLICY "Admins can update community posts"
  ON community_posts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  );

CREATE POLICY "Admins can delete community posts"
  ON community_posts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  );

-- Policies for community_post_reactions
CREATE POLICY "Users can view all reactions"
  ON community_post_reactions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can add their own reactions"
  ON community_post_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reactions"
  ON community_post_reactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_pinned ON community_posts(is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_reactions_post_id ON community_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_community_reactions_user_id ON community_post_reactions(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_community_post_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_community_posts_updated_at ON community_posts;
CREATE TRIGGER update_community_posts_updated_at
  BEFORE UPDATE ON community_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_community_post_updated_at();