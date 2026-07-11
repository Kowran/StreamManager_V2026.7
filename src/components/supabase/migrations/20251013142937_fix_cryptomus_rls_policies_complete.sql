/*
  # Fix Cryptomus Config RLS Policies

  1. Changes
    - Drop all existing policies on cryptomus_config
    - Create new policies that check profiles.role = 'admin'
    - Ensure admins can read, insert, update, and delete configurations
  
  2. Security
    - Only users with role 'admin' in profiles table can access
    - Separate policies for each operation (SELECT, INSERT, UPDATE, DELETE)
*/

-- Drop all existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can read cryptomus config" ON cryptomus_config;
  DROP POLICY IF EXISTS "Admins can insert cryptomus config" ON cryptomus_config;
  DROP POLICY IF EXISTS "Admins can update cryptomus config" ON cryptomus_config;
  DROP POLICY IF EXISTS "Admins can delete cryptomus config" ON cryptomus_config;
END $$;

-- Create new admin-only policies using profiles.role
CREATE POLICY "Admins can read cryptomus config"
  ON cryptomus_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert cryptomus config"
  ON cryptomus_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update cryptomus config"
  ON cryptomus_config
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

CREATE POLICY "Admins can delete cryptomus config"
  ON cryptomus_config
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
