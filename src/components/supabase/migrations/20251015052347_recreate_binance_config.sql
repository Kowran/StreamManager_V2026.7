/*
  # Recreate Binance Configuration Table

  1. New Tables
    - `binance_config`
      - `id` (uuid, primary key)
      - `api_key` (text) - Binance API Key
      - `api_secret` (text) - Binance API Secret
      - `merchant_id` (text) - Binance Merchant ID
      - `is_active` (boolean) - Whether Binance Pay is enabled
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `binance_config` table
    - Only admin users can view and modify Binance configuration
    - Uses the existing `is_admin_user()` function for admin checks

  3. Notes
    - This table stores Binance Pay payment gateway configuration
    - Only one configuration record should exist
    - Admins can enable/disable Binance Pay as a payment option
*/

CREATE TABLE IF NOT EXISTS binance_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key text NOT NULL,
  api_secret text NOT NULL,
  merchant_id text NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE binance_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view Binance config"
  ON binance_config FOR SELECT
  TO authenticated
  USING (is_admin_user());

CREATE POLICY "Admins can insert Binance config"
  ON binance_config FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can update Binance config"
  ON binance_config FOR UPDATE
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Admins can delete Binance config"
  ON binance_config FOR DELETE
  TO authenticated
  USING (is_admin_user());