/*
  # Fix RLS policies for streaming_services table

  1. Security Changes
    - Drop existing restrictive policies that are preventing INSERT operations
    - Create new policies that allow authenticated users to perform CRUD operations
    - Ensure INSERT policy allows authenticated users to create streaming services

  2. Changes Made
    - Remove overly restrictive INSERT policy
    - Add proper INSERT policy for authenticated users
    - Maintain existing SELECT, UPDATE, and DELETE policies with proper permissions
*/

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Authenticated users can delete streaming services" ON streaming_services;
DROP POLICY IF EXISTS "Authenticated users can insert streaming services" ON streaming_services;
DROP POLICY IF EXISTS "Authenticated users can read streaming services" ON streaming_services;
DROP POLICY IF EXISTS "Authenticated users can update streaming services" ON streaming_services;

-- Create new policies that allow authenticated users to perform all operations
CREATE POLICY "Allow authenticated users to read streaming services"
  ON streaming_services
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert streaming services"
  ON streaming_services
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update streaming services"
  ON streaming_services
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete streaming services"
  ON streaming_services
  FOR DELETE
  TO authenticated
  USING (true);