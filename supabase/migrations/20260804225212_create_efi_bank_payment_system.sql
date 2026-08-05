/*
# Create EFI Bank Payment System

1. New Tables
- `efi_payments` — stores PIX and boleto payments created via EFI Bank (Efí Pay) API.
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, NOT NULL, defaults to auth.uid())
  - `payment_id` (text) — the txid/charge ID returned by EFI Bank
  - `order_id` (text) — internal reference ID for the payment
  - `amount_brl` (numeric) — amount charged in BRL
  - `amount_usd` (numeric) — credits purchased in USD
  - `currency` (text, default 'BRL')
  - `billing_type` (text) — 'PIX' or 'BOLETO'
  - `status` (text, default 'pending') — payment status from EFI
  - `status_detail` (text)
  - `external_reference` (text)
  - `qr_code` (text) — PIX Copia e Cola code
  - `qr_code_base64` (text) — base64 QR code image
  - `invoice_url` (text) — boleto PDF URL
  - `expires_at` (timestamptz)
  - `approved_at` (timestamptz)
  - `credits_added` (boolean, default false) — whether credits were already added
  - `webhook_data` (jsonb) — raw API responses and webhook events
  - `created_at` / `updated_at` (timestamptz)

2. Security
- Enable RLS on `efi_payments`.
- Owner-scoped CRUD: each authenticated user can only access their own payment rows.
*/

CREATE TABLE IF NOT EXISTS efi_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id text,
  order_id text,
  amount_brl numeric(12,2) NOT NULL DEFAULT 0,
  amount_usd numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  billing_type text NOT NULL DEFAULT 'PIX',
  status text NOT NULL DEFAULT 'pending',
  status_detail text,
  external_reference text,
  qr_code text,
  qr_code_base64 text,
  invoice_url text,
  expires_at timestamptz,
  approved_at timestamptz,
  credits_added boolean NOT NULL DEFAULT false,
  webhook_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE efi_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_efi_payments" ON efi_payments;
CREATE POLICY "select_own_efi_payments"
  ON efi_payments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_efi_payments" ON efi_payments;
CREATE POLICY "insert_own_efi_payments"
  ON efi_payments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_efi_payments" ON efi_payments;
CREATE POLICY "update_own_efi_payments"
  ON efi_payments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_efi_payments" ON efi_payments;
CREATE POLICY "delete_own_efi_payments"
  ON efi_payments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_efi_payments_user_id ON efi_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_efi_payments_order_id ON efi_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_efi_payments_payment_id ON efi_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_efi_payments_status ON efi_payments(status);
