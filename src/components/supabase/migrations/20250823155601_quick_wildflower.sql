/*
  # Update streaming accounts access control

  1. Security Changes
    - Update RLS policies for streaming_accounts table
    - Users can only see their own accounts
    - Admins can see all accounts
    - Users can create accounts for themselves
    - Only admins can update/delete any account
    - Users can only update/delete their own accounts

  2. Policy Updates
    - Replace existing policies with new role-based access control
    - Ensure data isolation between users
    - Maintain admin privileges for full system management
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON streaming_accounts;

-- Create new policies for streaming accounts
CREATE POLICY "Users can view own accounts"
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

CREATE POLICY "Users can create own accounts"
  ON streaming_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own accounts"
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

CREATE POLICY "Users can delete own accounts"
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