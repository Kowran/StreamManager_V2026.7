/*
  # Add YouTube URL and Read Tracking to Community Posts

  1. Changes
    - Add youtube_url column to community_posts for embedding YouTube videos
    - Create community_post_reads table to track which users have read each post
    - This enables notification badges for unread posts

  2. New Tables
    - `community_post_reads`
      - `id` (uuid, primary key)
      - `post_id` (uuid, foreign key to community_posts)
      - `user_id` (uuid, foreign key to profiles)
      - `read_at` (timestamptz, when the user read the post)
      - Unique constraint on (post_id, user_id) to prevent duplicates

  3. Security
    - Enable RLS on community_post_reads table
    - Users can view their own read records
    - Users can insert their own read records
*/

-- Add youtube_url column to community_posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_posts' AND column_name = 'youtube_url'
  ) THEN
    ALTER TABLE community_posts ADD COLUMN youtube_url text;
  END IF;
END $$;

-- Create community_post_reads table
CREATE TABLE IF NOT EXISTS community_post_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS
ALTER TABLE community_post_reads ENABLE ROW LEVEL SECURITY;

-- Users can view their own read records
CREATE POLICY "Users can view own read records"
  ON community_post_reads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own read records
CREATE POLICY "Users can insert own read records"
  ON community_post_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_community_post_reads_user_id ON community_post_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_community_post_reads_post_id ON community_post_reads(post_id);