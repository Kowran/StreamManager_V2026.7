/*
  # Create OTP Accounts Table

  1. New Tables
    - `otp_accounts`
      - `id` (uuid, primary key)
      - `email` (text, account email)
      - `password` (text, account password)
      - `secret_key` (text, TOTP secret key in Base32 format)
      - `service_name` (text, name of the service like ChatGPT)
      - `issuer` (text, issuer name like OpenAI)
      - `account_name` (text, display name for the account)
      - `current_otp` (text, current OTP code)
      - `otp_expires_at` (timestamptz, when current OTP expires)
      - `active` (boolean, whether account is active)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `otp_accounts` table
    - Add policy for admins to manage all OTP accounts
    - Add policy to prevent non-admin access

  3. Indexes
    - Index on service_name for faster filtering
    - Index on active status
    - Index on created_at for ordering
*/

CREATE TABLE IF NOT EXISTS otp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password text NOT NULL,
  secret_key text NOT NULL,
  service_name text NOT NULL DEFAULT 'ChatGPT',
  issuer text NOT NULL DEFAULT 'OpenAI',
  account_name text NOT NULL,
  current_otp text,
  otp_expires_at timestamptz,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE otp_accounts ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_otp_accounts_service_name ON otp_accounts(service_name);
CREATE INDEX IF NOT EXISTS idx_otp_accounts_active ON otp_accounts(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_otp_accounts_created_at ON otp_accounts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_accounts_expires_at ON otp_accounts(otp_expires_at) WHERE otp_expires_at IS NOT NULL;

-- RLS Policies
CREATE POLICY "Admins can manage all OTP accounts"
  ON otp_accounts
  FOR ALL
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

-- Prevent non-admin access
CREATE POLICY "Non-admins cannot access OTP accounts"
  ON otp_accounts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_otp_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_otp_accounts_updated_at
  BEFORE UPDATE ON otp_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_otp_accounts_updated_at();