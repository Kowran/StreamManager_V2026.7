/*
  # Fix RLS policies for streaming_services table

  1. Security Changes
    - Drop existing restrictive policies
    - Add new policies that allow authenticated users to manage streaming services
    - Ensure INSERT, SELECT, UPDATE operations work properly for authenticated users

  2. Changes Made
    - Remove existing policies that may be too restrictive
    - Add new policies for authenticated users to perform all CRUD operations
    - Maintain security by requiring authentication
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Usuários podem atualizar serviços" ON streaming_services;
DROP POLICY IF EXISTS "Usuários podem inserir serviços" ON streaming_services;
DROP POLICY IF EXISTS "Usuários podem ler serviços" ON streaming_services;

-- Create new policies for authenticated users
CREATE POLICY "Authenticated users can read streaming services"
  ON streaming_services
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert streaming services"
  ON streaming_services
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update streaming services"
  ON streaming_services
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete streaming services"
  ON streaming_services
  FOR DELETE
  TO authenticated
  USING (true);