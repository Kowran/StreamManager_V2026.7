/*
  # Fix Community Polls RLS Policies
  
  1. Changes
    - Drop existing policies that reference incorrect table (users.user_type)
    - Create new policies that correctly reference profiles.role
    
  2. Security
    - Maintains same security model:
      - Anyone authenticated can view polls
      - Only admins can create, update, delete polls
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can create polls" ON community_polls;
DROP POLICY IF EXISTS "Admins can update polls" ON community_polls;
DROP POLICY IF EXISTS "Admins can delete polls" ON community_polls;

-- Recreate policies with correct table reference
CREATE POLICY "Admins can create polls"
  ON community_polls
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update polls"
  ON community_polls
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

CREATE POLICY "Admins can delete polls"
  ON community_polls
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
