/*
  # Add Categories to Community Posts

  1. Changes
    - Add `category` column to `community_posts` table
      - Type: text with check constraint for valid categories
      - Categories: tutorial, news, update, announcement, discussion
      - Default: 'announcement'
    - Add index on category for filtering
    - Update existing posts to have default category

  2. Categories
    - tutorial: Educational content and how-to guides
    - news: General news and information
    - update: System updates and changes
    - announcement: Official announcements and notices
    - discussion: General discussions and community topics
*/

-- Add category column with constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_posts' AND column_name = 'category'
  ) THEN
    ALTER TABLE community_posts 
    ADD COLUMN category text DEFAULT 'announcement' NOT NULL;
    
    ALTER TABLE community_posts
    ADD CONSTRAINT community_posts_category_check
    CHECK (category IN ('tutorial', 'news', 'update', 'announcement', 'discussion'));
  END IF;
END $$;

-- Create index for filtering by category
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON community_posts(category, created_at DESC);