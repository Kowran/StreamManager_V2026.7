/*
  # Create Binance Pay payments table

  1. New Tables
    - `binance_payments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `order_id` (text, unique)
      - `prepay_id` (text)
      - `amount_usd` (numeric)
      - `currency` (text)
      - `status` (text with check constraint)
      - `payment_url` (text)
      - `qr_code` (text)
      - `qr_content` (text)
      - `deeplink` (text)
      - `universal_url` (text)
      - `transaction_id` (text)
      - `transaction_time` (timestamp)
      - `expires_at` (timestamp)
      - `paid_at` (timestamp)
      - `webhook_data` (jsonb)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `binance_payments` table
    - Add policies for users to manage their own payments
    - Add policies for admins to manage all payments

  3. Indexes
    - Add indexes for performance on commonly queried columns
*/

CREATE TABLE IF NOT EXISTS binance_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id text UNIQUE NOT NULL,
  prepay_id text,
  amount_usd numeric(10,2) NOT NULL,
  currency text DEFAULT 'USDT' NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  payment_url text,
  qr_code text,
  qr_content text,
  deeplink text,
  universal_url text,
  transaction_id text,
  transaction_time timestamptz,
  expires_at timestamptz,
  paid_at timestamptz,
  webhook_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add check constraint for status
ALTER TABLE binance_payments 
ADD CONSTRAINT binance_payments_status_check 
CHECK (status IN ('pending', 'paid', 'expired', 'cancelled', 'failed'));

-- Enable RLS
ALTER TABLE binance_payments ENABLE ROW LEVEL SECURITY;

-- Policies for users
CREATE POLICY "Users can create own payments"
  ON binance_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own payments"
  ON binance_payments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policies for admins
CREATE POLICY "Admins can manage all payments"
  ON binance_payments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- System can update payments (for webhooks)
CREATE POLICY "System can update payments"
  ON binance_payments
  FOR UPDATE
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_binance_payments_user_id ON binance_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_binance_payments_order_id ON binance_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_binance_payments_status ON binance_payments(status);
CREATE INDEX IF NOT EXISTS idx_binance_payments_transaction_id ON binance_payments(transaction_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_binance_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_binance_payments_updated_at
  BEFORE UPDATE ON binance_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_binance_payments_updated_at();

-- Trigger to process confirmed payments
CREATE OR REPLACE FUNCTION process_confirmed_binance_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if status changed to 'paid'
  IF OLD.status != 'paid' AND NEW.status = 'paid' THEN
    -- This will be handled by the webhook function
    -- Just log the status change here
    INSERT INTO user_activity_logs (user_id, action, details)
    VALUES (
      NEW.user_id,
      'binance_payment_confirmed',
      jsonb_build_object(
        'payment_id', NEW.id,
        'order_id', NEW.order_id,
        'amount', NEW.amount_usd,
        'transaction_id', NEW.transaction_id,
        'confirmed_at', NEW.paid_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_process_confirmed_binance_payment
  BEFORE UPDATE ON binance_payments
  FOR EACH ROW
  EXECUTE FUNCTION process_confirmed_binance_payment();