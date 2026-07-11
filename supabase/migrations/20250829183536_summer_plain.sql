/*
  # Create Binance Payments Table

  1. New Tables
    - `binance_payments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `order_id` (text, unique)
      - `amount_usd` (numeric)
      - `asset` (text)
      - `network` (text)
      - `status` (text)
      - `receiving_address` (text)
      - `qr_code` (text)
      - `payment_url` (text)
      - `tx_id` (text)
      - `paid_at` (timestamp)
      - `expires_at` (timestamp)
      - `webhook_data` (jsonb)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `binance_payments` table
    - Add policies for users to manage their own payments
    - Add policies for admins to manage all payments

  3. Indexes
    - Add indexes for performance on common queries

  4. Triggers
    - Add trigger to process confirmed payments
*/

-- Create binance_payments table
CREATE TABLE IF NOT EXISTS binance_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id text UNIQUE NOT NULL,
  amount_usd numeric(10,2) NOT NULL,
  asset text NOT NULL DEFAULT 'USDT',
  network text NOT NULL DEFAULT 'TRC20',
  status text NOT NULL DEFAULT 'pending',
  receiving_address text,
  qr_code text,
  payment_url text,
  tx_id text,
  paid_at timestamptz,
  expires_at timestamptz,
  webhook_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraints
ALTER TABLE binance_payments 
ADD CONSTRAINT binance_payments_status_check 
CHECK (status IN ('pending', 'paid', 'expired', 'cancelled', 'failed'));

ALTER TABLE binance_payments 
ADD CONSTRAINT binance_payments_asset_check 
CHECK (asset IN ('USDT', 'BTC', 'ETH', 'BNB', 'BUSD'));

ALTER TABLE binance_payments 
ADD CONSTRAINT binance_payments_network_check 
CHECK (network IN ('TRC20', 'ERC20', 'BSC', 'BTC', 'ETH'));

-- Enable RLS
ALTER TABLE binance_payments ENABLE ROW LEVEL SECURITY;

-- Create policies
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

CREATE POLICY "Users can update own payments"
  ON binance_payments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_binance_payments_user_id ON binance_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_binance_payments_status ON binance_payments(status);
CREATE INDEX IF NOT EXISTS idx_binance_payments_order_id ON binance_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_binance_payments_created_at ON binance_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_binance_payments_expires_at ON binance_payments(expires_at) WHERE expires_at IS NOT NULL;

-- Create function to process confirmed Binance payments
CREATE OR REPLACE FUNCTION process_confirmed_binance_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    -- Add credits to user account
    INSERT INTO credit_transactions (
      user_id,
      type,
      amount,
      balance_before,
      balance_after,
      description,
      reference_id,
      reference_type,
      metadata
    )
    SELECT 
      NEW.user_id,
      'recharge',
      NEW.amount_usd,
      COALESCE(uc.balance, 0),
      COALESCE(uc.balance, 0) + NEW.amount_usd,
      'Recarga via Binance - ' || NEW.asset || ' (' || NEW.network || ')',
      NEW.id,
      'binance_payment',
      jsonb_build_object(
        'order_id', NEW.order_id,
        'asset', NEW.asset,
        'network', NEW.network,
        'tx_id', NEW.tx_id,
        'payment_method', 'binance_api'
      )
    FROM (
      SELECT COALESCE(balance, 0) as balance
      FROM user_credits 
      WHERE user_id = NEW.user_id
    ) uc;

    -- Create notification
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      priority,
      expires_at
    ) VALUES (
      NEW.user_id,
      'payment',
      '💰 Recarga Confirmada!',
      'Sua recarga de $' || NEW.amount_usd || ' via Binance foi confirmada! Seus créditos foram adicionados à sua conta.',
      jsonb_build_object(
        'payment_id', NEW.id,
        'order_id', NEW.order_id,
        'amount', NEW.amount_usd,
        'asset', NEW.asset,
        'network', NEW.network,
        'tx_id', NEW.tx_id
      ),
      'high',
      now() + interval '7 days'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_process_confirmed_binance_payment ON binance_payments;
CREATE TRIGGER trigger_process_confirmed_binance_payment
  BEFORE UPDATE ON binance_payments
  FOR EACH ROW
  EXECUTE FUNCTION process_confirmed_binance_payment();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_binance_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_binance_payments_updated_at ON binance_payments;
CREATE TRIGGER trigger_update_binance_payments_updated_at
  BEFORE UPDATE ON binance_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_binance_payments_updated_at();