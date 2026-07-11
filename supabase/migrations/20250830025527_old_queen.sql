/*
  # Create MercadoPago payments table

  1. New Tables
    - `mercadopago_payments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `payment_id` (text, MercadoPago payment ID)
      - `order_id` (text, our internal order ID)
      - `amount_brl` (numeric, amount in Brazilian Real)
      - `amount_usd` (numeric, amount in USD credits)
      - `currency` (text, currency code)
      - `payment_method` (text, pix or card)
      - `payment_method_id` (text, specific payment method from MP)
      - `status` (text, payment status)
      - `status_detail` (text, detailed status)
      - `external_reference` (text, reference for tracking)
      - `qr_code` (text, PIX QR code string)
      - `qr_code_base64` (text, PIX QR code base64 image)
      - `ticket_url` (text, payment ticket URL)
      - `approved_at` (timestamptz, when payment was approved)
      - `expires_at` (timestamptz, when payment expires)
      - `webhook_data` (jsonb, webhook and API response data)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `mercadopago_payments` table
    - Add policies for users to manage their own payments
    - Add policies for admins to manage all payments

  3. Indexes
    - Index on user_id for fast user queries
    - Index on payment_id for webhook lookups
    - Index on status for admin filtering
    - Index on created_at for chronological ordering

  4. Triggers
    - Trigger to process confirmed payments and add credits
    - Trigger to update timestamps
*/

-- Create the mercadopago_payments table
CREATE TABLE IF NOT EXISTS mercadopago_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id text NOT NULL,
  order_id text NOT NULL,
  amount_brl numeric(10,2) NOT NULL,
  amount_usd numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  payment_method text NOT NULL CHECK (payment_method IN ('pix', 'card')),
  payment_method_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'refunded', 'charged_back')),
  status_detail text,
  external_reference text,
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  approved_at timestamptz,
  expires_at timestamptz,
  webhook_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mercadopago_payments_user_id ON mercadopago_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_mercadopago_payments_payment_id ON mercadopago_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_mercadopago_payments_order_id ON mercadopago_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_mercadopago_payments_status ON mercadopago_payments(status);
CREATE INDEX IF NOT EXISTS idx_mercadopago_payments_created_at ON mercadopago_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mercadopago_payments_expires_at ON mercadopago_payments(expires_at) WHERE expires_at IS NOT NULL;

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS mercadopago_payments_payment_id_key ON mercadopago_payments(payment_id);
CREATE UNIQUE INDEX IF NOT EXISTS mercadopago_payments_order_id_key ON mercadopago_payments(order_id);

-- Enable Row Level Security
ALTER TABLE mercadopago_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own MercadoPago payments"
  ON mercadopago_payments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own MercadoPago payments"
  ON mercadopago_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own MercadoPago payments"
  ON mercadopago_payments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all MercadoPago payments"
  ON mercadopago_payments
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

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mercadopago_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_mercadopago_payments_updated_at
  BEFORE UPDATE ON mercadopago_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_mercadopago_payments_updated_at();

-- Create function to process confirmed MercadoPago payments
CREATE OR REPLACE FUNCTION process_confirmed_mercadopago_payment()
RETURNS TRIGGER AS $$
DECLARE
  current_balance numeric(10,2);
  current_total_recharged numeric(10,2);
  new_balance numeric(10,2);
  new_total_recharged numeric(10,2);
BEGIN
  -- Only process when status changes to approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Get current user credit balance
    SELECT balance, total_recharged INTO current_balance, current_total_recharged
    FROM user_credits 
    WHERE user_id = NEW.user_id;
    
    -- Set defaults if no record exists
    current_balance := COALESCE(current_balance, 0);
    current_total_recharged := COALESCE(current_total_recharged, 0);
    
    -- Calculate new balances
    new_balance := current_balance + NEW.amount_usd;
    new_total_recharged := current_total_recharged + NEW.amount_usd;
    
    -- Create credit transaction record
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
    ) VALUES (
      NEW.user_id,
      'recharge',
      NEW.amount_usd,
      current_balance,
      new_balance,
      'Recarga via Mercado Pago - R$ ' || NEW.amount_brl::text,
      NEW.id,
      'mercadopago_payment',
      jsonb_build_object(
        'payment_id', NEW.payment_id,
        'payment_method', NEW.payment_method,
        'amount_brl', NEW.amount_brl,
        'currency', NEW.currency,
        'approved_at', NEW.approved_at
      )
    );
    
    -- Update or insert user credit record
    INSERT INTO user_credits (user_id, balance, total_recharged, updated_at)
    VALUES (NEW.user_id, new_balance, new_total_recharged, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      balance = new_balance,
      total_recharged = new_total_recharged,
      updated_at = now();
      
    -- Create notification for successful payment
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
      'Sua recarga de R$ ' || NEW.amount_brl::text || ' via ' || 
      CASE 
        WHEN NEW.payment_method = 'pix' THEN 'PIX' 
        ELSE 'Cartão' 
      END || ' foi confirmada! $' || NEW.amount_usd::text || ' foram adicionados à sua conta.',
      jsonb_build_object(
        'payment_id', NEW.payment_id,
        'amount_brl', NEW.amount_brl,
        'amount_usd', NEW.amount_usd,
        'payment_method', NEW.payment_method,
        'new_balance', new_balance
      ),
      'high',
      now() + interval '7 days'
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for processing confirmed payments
CREATE TRIGGER trigger_process_confirmed_mercadopago_payment
  BEFORE UPDATE ON mercadopago_payments
  FOR EACH ROW
  EXECUTE FUNCTION process_confirmed_mercadopago_payment();