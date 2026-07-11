/*
  # Fix Admin Profile Update Policy

  1. Changes
    - Create new function to check if user is admin based on role
    - Update profiles table policies to allow admins to update other users' roles
    - This fixes the issue where admins cannot update seller roles

  2. Security
    - Only users with role='admin' can update other profiles
    - Regular users can still only update their own profiles
*/

-- Drop existing function with CASCADE to drop dependent policies
DROP FUNCTION IF EXISTS is_admin_user() CASCADE;

-- Create improved admin check function
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate admin policy for profiles
CREATE POLICY "Admins can manage all profiles"
  ON profiles
  FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Recreate admin policies for binance_config
CREATE POLICY "Admins can insert Binance config"
  ON binance_config
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can update Binance config"
  ON binance_config
  FOR UPDATE
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can delete Binance config"
  ON binance_config
  FOR DELETE
  TO authenticated
  USING (is_admin_user());

-- Recreate admin policies for email_imap_config
CREATE POLICY "Admins can view IMAP config"
  ON email_imap_config
  FOR SELECT
  TO authenticated
  USING (is_admin_user());

CREATE POLICY "Admins can insert IMAP config"
  ON email_imap_config
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can update IMAP config"
  ON email_imap_config
  FOR UPDATE
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can delete IMAP config"
  ON email_imap_config
  FOR DELETE
  TO authenticated
  USING (is_admin_user());

-- Recreate admin policies for netflix_login_codes
CREATE POLICY "Admins can view Netflix codes"
  ON netflix_login_codes
  FOR SELECT
  TO authenticated
  USING (is_admin_user());

CREATE POLICY "Admins can insert Netflix codes"
  ON netflix_login_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can update Netflix codes"
  ON netflix_login_codes
  FOR UPDATE
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can delete Netflix codes"
  ON netflix_login_codes
  FOR DELETE
  TO authenticated
  USING (is_admin_user());