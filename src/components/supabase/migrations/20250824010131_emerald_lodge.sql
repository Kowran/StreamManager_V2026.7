/*
  # Update streaming accounts RLS policies for individual user access

  1. Security Changes
    - Update RLS policies to ensure users can only access their own accounts
    - Maintain admin access for management purposes
    - Ensure proper user isolation

  2. Policy Updates
    - Users can only view, create, update, and delete their own streaming accounts
    - Admins maintain full access for system management
*/

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can create own accounts" ON streaming_accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON streaming_accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON streaming_accounts;
DROP POLICY IF EXISTS "Users can view own accounts" ON streaming_accounts;

-- Create comprehensive policies for individual user access
CREATE POLICY "Users can view own streaming accounts"
  ON streaming_accounts
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can create own streaming accounts"
  ON streaming_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own streaming accounts"
  ON streaming_accounts
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can delete own streaming accounts"
  ON streaming_accounts
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );