/*
  # Add Stripe Payments Table

  1. New Tables
    - `stripe_payments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `order_id` (text, unique)
      - `payment_intent_id` (text, unique)
      - `amount_usd` (numeric)
      - `currency` (text)
      - `status` (text with check constraint)
      - `client_secret` (text)
      - `stripe_charge_id` (text)
      - `description` (text)
      - `metadata` (jsonb)
      - `paid_at` (timestamptz)
      - `expires_at` (timestamptz)
      - `webhook_data` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `stripe_payments` table
    - Add policies for users to manage their own payments
    - Add policies for admins to manage all payments

  3. Indexes
    - Add indexes for performance on commonly queried columns
*/

-- Create stripe_payments table
CREATE TABLE IF NOT EXISTS stripe_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id text UNIQUE NOT NULL,
  payment_intent_id text UNIQUE NOT NULL,
  amount_usd numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  client_secret text,
  stripe_charge_id text,
  description text,
  metadata jsonb DEFAULT '{}',
  paid_at timestamptz,
  expires_at timestamptz,
  webhook_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add check constraint for status
ALTER TABLE stripe_payments 
ADD CONSTRAINT stripe_payments_status_check 
CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'expired'));

-- Add check constraint for currency
ALTER TABLE stripe_payments 
ADD CONSTRAINT stripe_payments_currency_check 
CHECK (currency IN ('USD', 'EUR', 'GBP', 'BRL'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stripe_payments_user_id ON stripe_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_status ON stripe_payments(status);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_created_at ON stripe_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_payment_intent_id ON stripe_payments(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payments_expires_at ON stripe_payments(expires_at) WHERE expires_at IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE stripe_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own Stripe payments"
  ON stripe_payments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own Stripe payments"
  ON stripe_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own Stripe payments"
  ON stripe_payments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all Stripe payments"
  ON stripe_payments
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

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stripe_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stripe_payments_updated_at
  BEFORE UPDATE ON stripe_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_payments_updated_at();

-- Create trigger to process confirmed Stripe payments
CREATE OR REPLACE FUNCTION process_confirmed_stripe_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if status changed to 'paid' and wasn't paid before
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    -- The credit addition and notification will be handled by the webhook function
    -- This trigger is mainly for logging and additional processing if needed
    
    -- Log the payment confirmation
    INSERT INTO user_activity_logs (user_id, action, details)
    VALUES (
      NEW.user_id,
      'stripe_payment_confirmed',
      jsonb_build_object(
        'payment_intent_id', NEW.payment_intent_id,
        'order_id', NEW.order_id,
        'amount_usd', NEW.amount_usd,
        'currency', NEW.currency,
        'confirmed_at', NEW.paid_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_process_confirmed_stripe_payment
  BEFORE UPDATE ON stripe_payments
  FOR EACH ROW
  EXECUTE FUNCTION process_confirmed_stripe_payment();