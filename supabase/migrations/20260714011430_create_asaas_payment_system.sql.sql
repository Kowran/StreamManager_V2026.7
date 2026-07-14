/*
# Create Asaas Payment System

1. New Tables
- `asaas_payments`: Records of Asaas payment transactions for credit recharges.
  - `id` (uuid, PK)
  - `user_id` (uuid, references auth.users)
  - `payment_id` (text, Asaas payment ID)
  - `order_id` (text, locally generated unique order reference)
  - `amount_brl` (numeric, amount in BRL)
  - `amount_usd` (numeric, credit amount in USD)
  - `currency` (text, default 'BRL')
  - `billing_type` (text: 'PIX' | 'BOLETO' | 'CREDIT_CARD')
  - `status` (text: 'pending' | 'confirmed' | 'received' | 'overdue' | 'refunded' | 'rejected')
  - `status_detail` (text)
  - `external_reference` (text, same as order_id)
  - `qr_code` (text, PIX copy-paste code)
  - `qr_code_image` (text, base64 QR image)
  - `invoice_url` (text, Asaas invoice/checkout URL)
  - `expires_at` (timestamptz, 30 min from creation for PIX)
  - `approved_at` (timestamptz, set when confirmed)
  - `webhook_data` (jsonb, raw gateway responses)
  - `credits_added` (boolean, default false, idempotency guard)
  - `created_at`, `updated_at` (timestamptz)

2. Security
- RLS enabled on `asaas_payments`.
- Owner-scoped CRUD: authenticated users can only access their own payment records.
- Webhook edge function uses service role key (bypasses RLS).

3. Notes
- `credits_added` column prevents double-crediting if webhook fires multiple times.
- Config stored in existing `system_config` table under key `asaas_config`.
*/

CREATE TABLE IF NOT EXISTS asaas_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id text,
  order_id text UNIQUE NOT NULL,
  amount_brl numeric NOT NULL DEFAULT 0,
  amount_usd numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  billing_type text NOT NULL DEFAULT 'PIX',
  status text NOT NULL DEFAULT 'pending',
  status_detail text,
  external_reference text,
  qr_code text,
  qr_code_image text,
  invoice_url text,
  expires_at timestamptz,
  approved_at timestamptz,
  webhook_data jsonb,
  credits_added boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asaas_payments_user_id ON asaas_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_asaas_payments_order_id ON asaas_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_asaas_payments_payment_id ON asaas_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_asaas_payments_status ON asaas_payments(status);

ALTER TABLE asaas_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_asaas_payments" ON asaas_payments;
CREATE POLICY "select_own_asaas_payments" ON asaas_payments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_asaas_payments" ON asaas_payments;
CREATE POLICY "insert_own_asaas_payments" ON asaas_payments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_asaas_payments" ON asaas_payments;
CREATE POLICY "update_own_asaas_payments" ON asaas_payments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_asaas_payments" ON asaas_payments;
CREATE POLICY "delete_own_asaas_payments" ON asaas_payments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Insert asaas into payment_methods_config if not exists
INSERT INTO payment_methods_config (method_id, name, is_active, status, display_order)
SELECT 'asaas', 'Asaas (PIX)', true, 'active', 8
WHERE NOT EXISTS (
  SELECT 1 FROM payment_methods_config WHERE method_id = 'asaas'
);
