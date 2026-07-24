/*
# Create InfinitePay Payment System

1. New Tables
- `infinitepay_payments`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, references auth.users)
  - `order_id` (text, unique, not null) — our internal order reference
  - `amount_usd` (numeric, not null) — amount in USD/credits
  - `amount_brl` (numeric, not null) — amount charged in BRL
  - `status` (text, not null, default 'pending') — pending, approved, expired, failed
  - `invoice_slug` (text) — InfinitePay invoice identifier
  - `checkout_url` (text) — InfinitePay hosted checkout URL
  - `transaction_nsu` (text) — InfinitePay transaction NSU
  - `payment_method` (text) — pix, credit_card
  - `credits_added` (boolean, default false) — whether credits were already added
  - `created_at` (timestamptz, default now)
  - `updated_at` (timestamptz, default now)

2. Security
- Enable RLS on `infinitepay_payments`.
- Owner-scoped CRUD: each authenticated user can only access their own payment records.
- INSERT is allowed for authenticated users creating their own payment.
- UPDATE/DELETE restricted to owner.

3. Notes
- Config is stored in `system_config` under key `infinitepay_config` (same pattern as Asaas).
- The payment_methods_config table gets a new row for 'infinitepay' so it appears in the checkout/credits UI.
*/

CREATE TABLE IF NOT EXISTS infinitepay_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id text UNIQUE NOT NULL,
  amount_usd numeric NOT NULL DEFAULT 0,
  amount_brl numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  invoice_slug text,
  checkout_url text,
  transaction_nsu text,
  payment_method text DEFAULT 'pix',
  credits_added boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE infinitepay_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_infinitepay_payments" ON infinitepay_payments;
CREATE POLICY "select_own_infinitepay_payments"
  ON infinitepay_payments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_infinitepay_payments" ON infinitepay_payments;
CREATE POLICY "insert_own_infinitepay_payments"
  ON infinitepay_payments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_infinitepay_payments" ON infinitepay_payments;
CREATE POLICY "update_own_infinitepay_payments"
  ON infinitepay_payments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_infinitepay_payments" ON infinitepay_payments;
CREATE POLICY "delete_own_infinitepay_payments"
  ON infinitepay_payments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Register InfinitePay as a payment method in payment_methods_config (idempotent)
INSERT INTO payment_methods_config (method_id, name, is_active, status, display_order)
SELECT 'infinitepay', 'InfinitePay (PIX)', false, 'inactive', 9
WHERE NOT EXISTS (
  SELECT 1 FROM payment_methods_config WHERE method_id = 'infinitepay'
);