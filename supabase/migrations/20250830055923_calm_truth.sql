/*
  # Add PayPal payments table

  1. New Tables
    - `paypal_payments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `order_id` (text, unique)
      - `paypal_order_id` (text, unique)
      - `amount_usd` (numeric, amount to credit to user)
      - `total_charged` (numeric, total amount charged including fees)
      - `paypal_fee` (numeric, PayPal processing fee)
      - `currency` (text)
      - `status` (text)
      - `approval_url` (text)
      - `description` (text)
      - `metadata` (jsonb)
      - `completed_at` (timestamptz)
      - `expires_at` (timestamptz)
      - `webhook_data` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `paypal_payments` table
    - Add policies for users to manage their own payments
    - Add policies for admins to manage all payments

  3. Triggers
    - Add trigger to process confirmed PayPal payments
    - Add trigger to update timestamps
*/

CREATE TABLE IF NOT EXISTS paypal_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id text UNIQUE NOT NULL,
  paypal_order_id text UNIQUE NOT NULL,
  amount_usd numeric(10,2) NOT NULL,
  total_charged numeric(10,2) NOT NULL,
  paypal_fee numeric(10,2) NOT NULL DEFAULT 0.00,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'CREATED',
  approval_url text,
  description text,
  metadata jsonb DEFAULT '{}',
  completed_at timestamptz,
  expires_at timestamptz,
  webhook_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraints
ALTER TABLE paypal_payments 
ADD CONSTRAINT paypal_payments_status_check 
CHECK (status IN ('CREATED', 'SAVED', 'APPROVED', 'VOIDED', 'COMPLETED', 'PAYER_ACTION_REQUIRED', 'CANCELLED', 'FAILED'));

ALTER TABLE paypal_payments 
ADD CONSTRAINT paypal_payments_currency_check 
CHECK (currency IN ('USD', 'EUR', 'GBP', 'BRL', 'CAD', 'AUD'));

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_paypal_payments_user_id ON paypal_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_paypal_payments_order_id ON paypal_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_paypal_payments_paypal_order_id ON paypal_payments(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_paypal_payments_status ON paypal_payments(status);
CREATE INDEX IF NOT EXISTS idx_paypal_payments_created_at ON paypal_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paypal_payments_expires_at ON paypal_payments(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE paypal_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can create own PayPal payments"
  ON paypal_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own PayPal payments"
  ON paypal_payments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own PayPal payments"
  ON paypal_payments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all PayPal payments"
  ON paypal_payments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Function to process confirmed PayPal payments
CREATE OR REPLACE FUNCTION process_confirmed_paypal_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to COMPLETED
  IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN
    -- Get current user credit balance
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
      NEW.amount_usd, -- Credit only the original amount, not the fees
      COALESCE(uc.balance, 0),
      COALESCE(uc.balance, 0) + NEW.amount_usd,
      'Recarga via PayPal - $' || NEW.amount_usd::text || ' (cobrado $' || NEW.total_charged::text || ' com taxas)',
      NEW.id,
      'paypal_payment',
      jsonb_build_object(
        'paypal_order_id', NEW.paypal_order_id,
        'payment_method', 'paypal',
        'currency', NEW.currency,
        'original_amount', NEW.amount_usd,
        'total_charged', NEW.total_charged,
        'paypal_fee', NEW.paypal_fee,
        'fees_excluded_from_balance', true
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
      '💰 Recarga PayPal Confirmada!',
      'Sua recarga de $' || NEW.amount_usd::text || ' via PayPal foi confirmada! Total cobrado: $' || NEW.total_charged::text || ' (inclui taxas de $' || NEW.paypal_fee::text || ').',
      jsonb_build_object(
        'paypal_order_id', NEW.paypal_order_id,
        'amount', NEW.amount_usd,
        'total_charged', NEW.total_charged,
        'paypal_fee', NEW.paypal_fee,
        'currency', NEW.currency,
        'payment_method', 'paypal'
      ),
      'high',
      now() + interval '7 days'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for PayPal payment processing
CREATE TRIGGER trigger_process_confirmed_paypal_payment
  BEFORE UPDATE ON paypal_payments
  FOR EACH ROW
  EXECUTE FUNCTION process_confirmed_paypal_payment();

-- Function to update PayPal payments updated_at timestamp
CREATE OR REPLACE FUNCTION update_paypal_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating timestamps
CREATE TRIGGER trigger_update_paypal_payments_updated_at
  BEFORE UPDATE ON paypal_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_paypal_payments_updated_at();