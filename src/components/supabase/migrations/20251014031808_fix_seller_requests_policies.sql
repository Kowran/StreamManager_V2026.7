/*
  # Fix Seller Requests RLS Policies

  1. Changes
    - Drop existing policies that reference incorrect `users` table
    - Create new policies that correctly reference `profiles` table with `role` column
    
  2. Security
    - Admins can view all seller requests
    - Admins can update seller requests
    - Users can create their own seller requests
    - Users can view their own seller requests
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view all seller requests" ON seller_requests;
DROP POLICY IF EXISTS "Admins can update seller requests" ON seller_requests;
DROP POLICY IF EXISTS "Users can view own seller requests" ON seller_requests;
DROP POLICY IF EXISTS "Users can create seller requests" ON seller_requests;

-- Create corrected policies using profiles table
CREATE POLICY "Admins can view all seller requests"
  ON seller_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update seller requests"
  ON seller_requests
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

CREATE POLICY "Users can view own seller requests"
  ON seller_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create seller requests"
  ON seller_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
