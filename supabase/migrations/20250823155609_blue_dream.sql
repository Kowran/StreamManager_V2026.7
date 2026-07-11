/*
  # Update account profiles access control

  1. Security Changes
    - Update RLS policies for account_profiles table
    - Users can only see profiles from their own accounts
    - Admins can see all profiles
    - Users can manage profiles only for their own accounts

  2. Policy Updates
    - Replace existing policies with new role-based access control
    - Ensure users can only access profiles from accounts they own
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can manage account profiles" ON account_profiles;

-- Create new policies for account profiles
CREATE POLICY "Users can view own account profiles"
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

CREATE POLICY "Users can update own account profiles"
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

CREATE POLICY "Users can delete own account profiles"
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