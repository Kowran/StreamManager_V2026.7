/*
  # Create Netflix Accounts Configuration Table

  1. New Tables
    - `netflix_accounts`
      - `id` (uuid, primary key) - Unique identifier
      - `email` (text) - Netflix account email
      - `password` (text) - Netflix account password (encrypted)
      - `is_active` (boolean) - Whether account is active for checking
      - `last_checked` (timestamptz) - Last time code was checked
      - `last_code` (text) - Last code found (if any)
      - `notes` (text) - Optional notes about the account
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `netflix_accounts` table
    - Add policies for authenticated admin users to manage accounts
    - Uses profiles.role = 'admin' for authorization
*/

CREATE TABLE IF NOT EXISTS netflix_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password text NOT NULL,
  is_active boolean DEFAULT true,
  last_checked timestamptz,
  last_code text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE netflix_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view Netflix accounts"
  ON netflix_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert Netflix accounts"
  ON netflix_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update Netflix accounts"
  ON netflix_accounts
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

CREATE POLICY "Admins can delete Netflix accounts"
  ON netflix_accounts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_netflix_accounts_active ON netflix_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_netflix_accounts_last_checked ON netflix_accounts(last_checked);