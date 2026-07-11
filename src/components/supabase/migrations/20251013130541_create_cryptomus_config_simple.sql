/*
  # Create Cryptomus Configuration Table

  1. New Tables
    - `cryptomus_config`
      - `id` (uuid, primary key)
      - `merchant_id` (text)
      - `api_secret` (text)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS
    - Only admin users can read/write configuration
*/

-- Create cryptomus_config table
CREATE TABLE IF NOT EXISTS cryptomus_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text DEFAULT '',
  api_secret text DEFAULT '',
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE cryptomus_config ENABLE ROW LEVEL SECURITY;

-- Admin read policy (using user_type from users table)
CREATE POLICY "Admins can read cryptomus config"
  ON cryptomus_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  );

-- Admin write policy
CREATE POLICY "Admins can update cryptomus config"
  ON cryptomus_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'admin'
    )
  );

-- Insert default config if table is empty
INSERT INTO cryptomus_config (merchant_id, api_secret, is_active)
SELECT '', '', false
WHERE NOT EXISTS (SELECT 1 FROM cryptomus_config);
