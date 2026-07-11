/*
  # Add Cryptomus payment support

  1. Updates to credit_recharges table
    - Add support for Cryptomus payment method
    - Update payment_method enum to include 'cryptomus'
    - Enhance payment_data structure for crypto payments

  2. Security
    - Maintain existing RLS policies
    - Add indexes for better performance

  3. Changes
    - Update payment_method check constraint
    - Add new payment method option
*/

-- Update the payment_method check constraint to include cryptomus
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'credit_recharges' 
    AND constraint_name = 'credit_recharges_payment_method_check'
  ) THEN
    ALTER TABLE credit_recharges DROP CONSTRAINT credit_recharges_payment_method_check;
  END IF;
  
  -- Add new constraint with cryptomus support
  ALTER TABLE credit_recharges ADD CONSTRAINT credit_recharges_payment_method_check 
    CHECK (payment_method = ANY (ARRAY['binance_pay'::text, 'cryptomus'::text, 'manual'::text]));
END $$;

-- Add index for payment method if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'credit_recharges' 
    AND indexname = 'idx_credit_recharges_payment_method'
  ) THEN
    CREATE INDEX idx_credit_recharges_payment_method ON credit_recharges(payment_method);
  END IF;
END $$;

-- Add index for payment_data jsonb queries if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'credit_recharges' 
    AND indexname = 'idx_credit_recharges_payment_data_uuid'
  ) THEN
    CREATE INDEX idx_credit_recharges_payment_data_uuid ON credit_recharges 
    USING GIN ((payment_data->'cryptomus_uuid'));
  END IF;
END $$;

-- Add comment to document the new payment method
COMMENT ON COLUMN credit_recharges.payment_method IS 'Payment method used: binance_pay, cryptomus, or manual';
COMMENT ON COLUMN credit_recharges.payment_data IS 'JSON data containing payment-specific information including Cryptomus payment details';