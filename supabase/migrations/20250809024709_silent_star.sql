/*
  # Fix RLS INSERT policy for streaming_services table

  1. Changes
    - Drop existing INSERT policy that may be too restrictive
    - Create new INSERT policy that allows authenticated users to insert streaming services
    - Ensure the policy condition properly checks for authenticated users

  2. Security
    - Maintains RLS protection by requiring authentication
    - Allows authenticated users to create new streaming services
*/

-- Drop the existing INSERT policy if it exists
DROP POLICY IF EXISTS "Usuários podem inserir serviços" ON streaming_services;
DROP POLICY IF EXISTS "Allow authenticated users to insert streaming services" ON streaming_services;

-- Create a new INSERT policy that allows authenticated users to insert streaming services
CREATE POLICY "Allow authenticated users to insert streaming services"
  ON streaming_services
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);