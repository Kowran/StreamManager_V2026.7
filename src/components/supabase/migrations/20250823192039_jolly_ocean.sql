/*
  # Accounts Access Control System

  1. New Tables
    - `accounts_access_purchases`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `order_id` (uuid, foreign key to store_orders)
      - `purchased_at` (timestamp)
      - `expires_at` (timestamp)
      - `active` (boolean)

  2. Security
    - Enable RLS on `accounts_access_purchases` table
    - Add policies for users to read their own access data
    - Add policies for admins to manage all access data

  3. Changes
    - Create table to track accounts access purchases
    - Set up automatic expiration logic
    - Add indexes for performance
*/

-- Create accounts access purchases table
CREATE TABLE IF NOT EXISTS accounts_access_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES store_orders(id) ON DELETE SET NULL,
  purchased_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE accounts_access_purchases ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own access data"
  ON accounts_access_purchases
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all access data"
  ON accounts_access_purchases
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert access records"
  ON accounts_access_purchases
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_access_user_id 
  ON accounts_access_purchases(user_id);

CREATE INDEX IF NOT EXISTS idx_accounts_access_expires_at 
  ON accounts_access_purchases(expires_at);

CREATE INDEX IF NOT EXISTS idx_accounts_access_active 
  ON accounts_access_purchases(active) 
  WHERE active = true;

-- Insert the accounts access product
INSERT INTO store_products (
  name,
  description,
  price_brl,
  price_usdt,
  category,
  image_url,
  stock_quantity,
  auto_delivery,
  active
) VALUES (
  'Accounts Manager Access',
  'Get 30-day access to the Accounts Manager feature. Manage your streaming accounts, profiles, and track usage efficiently.',
  27.50, -- $5 * 5.5 BRL rate
  5.00,
  'access',
  'https://images.pexels.com/photos/5380664/pexels-photo-5380664.jpeg?auto=compress&cs=tinysrgb&w=400',
  999999, -- Infinite stock for digital product
  true,
  true
) ON CONFLICT DO NOTHING;

-- Function to check if user has active accounts access
CREATE OR REPLACE FUNCTION has_accounts_access(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_uuid AND role = 'admin'
  ) THEN
    RETURN true;
  END IF;

  -- Check if user has active access
  RETURN EXISTS (
    SELECT 1 FROM accounts_access_purchases
    WHERE user_id = user_uuid 
      AND active = true 
      AND expires_at > now()
  );
END;
$$;

-- Function to automatically deactivate expired access
CREATE OR REPLACE FUNCTION deactivate_expired_accounts_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE accounts_access_purchases
  SET active = false, updated_at = now()
  WHERE active = true AND expires_at <= now();
END;
$$;