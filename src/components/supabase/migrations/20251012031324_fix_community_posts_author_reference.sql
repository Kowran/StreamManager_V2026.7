/*
  # Fix Community Posts Author Reference
  
  1. Changes
    - Update community_posts.author_id foreign key to reference profiles table
    - This allows proper JOIN operations from client-side queries
  
  2. Notes
    - Keeps existing data intact
    - Improves query performance by using profiles table
*/

-- Drop the existing foreign key constraint
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'community_posts_author_id_fkey' 
    AND table_name = 'community_posts'
  ) THEN
    ALTER TABLE community_posts DROP CONSTRAINT community_posts_author_id_fkey;
  END IF;
END $$;

-- Add new foreign key constraint referencing profiles
ALTER TABLE community_posts
  ADD CONSTRAINT community_posts_author_id_fkey
  FOREIGN KEY (author_id)
  REFERENCES profiles(id)
  ON DELETE SET NULL;
