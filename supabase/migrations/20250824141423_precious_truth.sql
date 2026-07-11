/*
  # Add MercadoPago payment support

  1. Updates
    - Update credit_recharges table to support MercadoPago payment method
    - Add MercadoPago configuration to system_config

  2. Security
    - Maintain existing RLS policies
    - Ensure secure storage of payment data
*/

-- Update credit_recharges payment_method check constraint to include mercadopago
DO $$
BEGIN
  -- Drop existing constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'credit_recharges' 
    AND constraint_name = 'credit_recharges_payment_method_check'
  ) THEN
    ALTER TABLE credit_recharges DROP CONSTRAINT credit_recharges_payment_method_check;
  END IF;
  
  -- Add new constraint with mercadopago support
  ALTER TABLE credit_recharges ADD CONSTRAINT credit_recharges_payment_method_check 
    CHECK (payment_method = ANY (ARRAY['binance_pay'::text, 'cryptomus'::text, 'mercadopago'::text, 'manual'::text]));
END $$;

-- Insert MercadoPago configuration template if it doesn't exist
INSERT INTO system_config (key, value, description)
VALUES (
  'mercadopago_config',
  '{
    "access_token": "",
    "public_key": "",
    "enabled": false,
    "test_mode": true
  }'::jsonb,
  'Configurações da API Mercado Pago para pagamentos com PIX e cartões'
)
ON CONFLICT (key) DO NOTHING;

-- Add index for MercadoPago payment method
CREATE INDEX IF NOT EXISTS idx_credit_recharges_mercadopago 
ON credit_recharges (payment_method) 
WHERE payment_method = 'mercadopago';

-- Add index for MercadoPago payment data
CREATE INDEX IF NOT EXISTS idx_credit_recharges_mercadopago_payment_id 
ON credit_recharges USING gin (((payment_data -> 'mercadopago_payment_id'::text)));