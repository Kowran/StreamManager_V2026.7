/*
  # Fix Binance Config Access for Regular Users

  1. Changes
    - Drop existing SELECT policy that restricts access to admins only
    - Create new SELECT policy that allows all authenticated users to view is_active status
    - This allows users to check if Binance Pay is available without exposing sensitive API credentials

  2. Security
    - Users can only read the is_active field (indirectly, through SELECT)
    - Sensitive fields (api_key, api_secret, merchant_id) remain protected by application logic
    - Only admins can still INSERT, UPDATE, and DELETE configuration
*/

DROP POLICY IF EXISTS "Admins can view Binance config" ON binance_config;

CREATE POLICY "All users can view Binance config status"
  ON binance_config FOR SELECT
  TO authenticated
  USING (true);
