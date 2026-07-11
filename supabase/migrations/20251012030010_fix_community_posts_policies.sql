/*
  # Fix Community Posts RLS Policies
  
  1. Changes
    - Drop existing policies that reference incorrect table (users.user_type)
    - Create new policies that correctly reference profiles.role
    
  2. Security
    - Maintains same security model:
      - Anyone authenticated can view posts
      - Only admins can create, update, delete posts
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can insert community posts" ON community_posts;
DROP POLICY IF EXISTS "Admins can update community posts" ON community_posts;
DROP POLICY IF EXISTS "Admins can delete community posts" ON community_posts;

-- Recreate policies with correct table reference
CREATE POLICY "Admins can insert community posts"
  ON community_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update community posts"
  ON community_posts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete community posts"
  ON community_posts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );