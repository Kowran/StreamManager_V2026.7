/*
# Create payment methods configuration table

1. New Tables
- `payment_methods_config` — stores admin-controlled visibility/activation of each payment method
  - `id` (uuid, primary key)
  - `method_id` (text, unique, not null) — e.g. 'stripe', 'paypal', 'mercadopago', 'cryptomus', 'binance', 'whatsapp', 'triplea'
  - `name` (text, not null) — display name
  - `is_active` (boolean, default true) — whether the method is active and visible to users
  - `display_order` (integer, default 0) — sort order
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Security
- Enable RLS on `payment_methods_config`.
- Authenticated users can SELECT to see which methods are active.
- Only admin users (profiles.role = 'admin') can INSERT/UPDATE/DELETE.

3. Seed Data
- Inserts default rows for all 7 payment methods, all active by default.
*/

CREATE TABLE IF NOT EXISTS payment_methods_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method_id text UNIQUE NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_methods_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_payment_methods_config" ON payment_methods_config;
CREATE POLICY "select_payment_methods_config"
  ON payment_methods_config FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_payment_methods_config_admin" ON payment_methods_config;
CREATE POLICY "insert_payment_methods_config_admin"
  ON payment_methods_config FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "update_payment_methods_config_admin" ON payment_methods_config;
CREATE POLICY "update_payment_methods_config_admin"
  ON payment_methods_config FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "delete_payment_methods_config_admin" ON payment_methods_config;
CREATE POLICY "delete_payment_methods_config_admin"
  ON payment_methods_config FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

INSERT INTO payment_methods_config (method_id, name, is_active, display_order) VALUES
  ('stripe', 'Cartão de Crédito/Débito', true, 1),
  ('paypal', 'PayPal', true, 2),
  ('mercadopago', 'PIX / Mercado Pago', true, 3),
  ('cryptomus', 'Cryptomus', true, 4),
  ('binance', 'Binance Pay', true, 5),
  ('whatsapp', 'WhatsApp Manual', true, 6),
  ('triplea', 'Triple-A Crypto', true, 7)
ON CONFLICT (method_id) DO NOTHING;
