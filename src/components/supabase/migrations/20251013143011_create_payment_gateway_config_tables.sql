/*
  # Create Payment Gateway Configuration Tables

  1. New Tables
    - `stripe_config` - Stripe payment gateway configuration
    - `paypal_config` - PayPal payment gateway configuration
    - `mercadopago_config` - Mercado Pago payment gateway configuration
  
  2. Security
    - Enable RLS on all tables
    - Only admins can access configuration tables
    - Separate policies for each operation
  
  3. Default Values
    - All gateways disabled by default
    - Secure credential storage
*/

-- Create stripe_config table
CREATE TABLE IF NOT EXISTS stripe_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_key text DEFAULT '',
  publishable_key text DEFAULT '',
  webhook_secret text DEFAULT '',
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create paypal_config table
CREATE TABLE IF NOT EXISTS paypal_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text DEFAULT '',
  client_secret text DEFAULT '',
  webhook_id text DEFAULT '',
  is_active boolean DEFAULT false,
  sandbox_mode boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create mercadopago_config table
CREATE TABLE IF NOT EXISTS mercadopago_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text DEFAULT '',
  public_key text DEFAULT '',
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE stripe_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE paypal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE mercadopago_config ENABLE ROW LEVEL SECURITY;

-- Stripe Config Policies
CREATE POLICY "Admins can read stripe config"
  ON stripe_config FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can insert stripe config"
  ON stripe_config FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can update stripe config"
  ON stripe_config FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can delete stripe config"
  ON stripe_config FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- PayPal Config Policies
CREATE POLICY "Admins can read paypal config"
  ON paypal_config FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can insert paypal config"
  ON paypal_config FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can update paypal config"
  ON paypal_config FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can delete paypal config"
  ON paypal_config FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- MercadoPago Config Policies
CREATE POLICY "Admins can read mercadopago config"
  ON mercadopago_config FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can insert mercadopago config"
  ON mercadopago_config FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can update mercadopago config"
  ON mercadopago_config FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE POLICY "Admins can delete mercadopago config"
  ON mercadopago_config FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
