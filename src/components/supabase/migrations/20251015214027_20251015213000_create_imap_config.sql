/*
  # Create IMAP Configuration Table

  1. New Tables
    - `imap_config`
      - `id` (uuid, primary key)
      - `host` (text) - IMAP server host (e.g., imap.gmail.com)
      - `port` (integer) - IMAP server port (e.g., 993)
      - `secure` (boolean) - Use SSL/TLS connection
      - `email` (text) - Email address for authentication
      - `password` (text) - Encrypted password for authentication
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `imap_config` table
    - Add policy for admin users to read/write configuration
*/

CREATE TABLE IF NOT EXISTS imap_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host text NOT NULL,
  port integer NOT NULL DEFAULT 993,
  secure boolean NOT NULL DEFAULT true,
  email text NOT NULL,
  password text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE imap_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can read IMAP config"
  ON imap_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can insert IMAP config"
  ON imap_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin users can update IMAP config"
  ON imap_config
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

CREATE POLICY "Admin users can delete IMAP config"
  ON imap_config
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );