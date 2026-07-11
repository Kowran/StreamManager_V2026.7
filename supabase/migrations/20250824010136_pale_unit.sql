/*
  # Update account profiles RLS policies for individual user access

  1. Security Changes
    - Update RLS policies to ensure users can only access profiles from their own accounts
    - Maintain admin access for management purposes
    - Ensure proper user isolation through account ownership

  2. Policy Updates
    - Users can only manage profiles for accounts they own
    - Admins maintain full access for system management
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own account profiles" ON account_profiles;
DROP POLICY IF EXISTS "Users can create profiles for own accounts" ON account_profiles;
DROP POLICY IF EXISTS "Users can update own account profiles" ON account_profiles;
DROP POLICY IF EXISTS "Users can delete own account profiles" ON account_profiles;

-- Create new policies based on account ownership
CREATE POLICY "Users can view profiles from own accounts"
  ON account_profiles
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM streaming_accounts
      WHERE user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can create profiles for own accounts"
  ON account_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT id FROM streaming_accounts
      WHERE user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can update profiles from own accounts"
  ON account_profiles
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM streaming_accounts
      WHERE user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT id FROM streaming_accounts
      WHERE user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can delete profiles from own accounts"
  ON account_profiles
  FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT id FROM streaming_accounts
      WHERE user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );