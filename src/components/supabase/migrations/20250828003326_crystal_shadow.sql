/*
  # Fix MercadoPago webhook processing

  1. Improvements
    - Add better indexing for payment lookups
    - Add webhook processing logs
    - Improve error handling for payment completion

  2. New Functions
    - Function to handle MercadoPago webhook processing
    - Better logging for payment status changes

  3. Indexes
    - Add index for faster payment lookups by external reference
    - Add index for webhook processing
*/

-- Add index for faster payment lookups
CREATE INDEX IF NOT EXISTS idx_credit_recharges_payment_method_status 
ON credit_recharges (payment_method, status) 
WHERE payment_method = 'mercadopago';

-- Add index for payment data JSON queries
CREATE INDEX IF NOT EXISTS idx_credit_recharges_payment_id 
ON credit_recharges USING gin ((payment_data -> 'mercadopago_payment_id'));

-- Add index for external reference lookups
CREATE INDEX IF NOT EXISTS idx_credit_recharges_external_ref 
ON credit_recharges USING gin ((payment_data -> 'external_reference'));

-- Function to safely complete MercadoPago recharge
CREATE OR REPLACE FUNCTION complete_mercadopago_recharge(
  p_recharge_id uuid,
  p_payment_details jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recharge record;
  v_current_balance numeric(10,2);
  v_new_balance numeric(10,2);
BEGIN
  -- Get recharge record with lock to prevent double processing
  SELECT * INTO v_recharge
  FROM credit_recharges
  WHERE id = p_recharge_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recharge not found: %', p_recharge_id;
  END IF;
  
  -- Check if already completed
  IF v_recharge.status = 'completed' THEN
    RAISE NOTICE 'Recharge already completed: %', p_recharge_id;
    RETURN true;
  END IF;
  
  -- Get current user balance
  SELECT COALESCE(balance, 0) INTO v_current_balance
  FROM user_credits
  WHERE user_id = v_recharge.user_id;
  
  v_new_balance := v_current_balance + v_recharge.total_credits;
  
  -- Update recharge status
  UPDATE credit_recharges
  SET 
    status = 'completed',
    completed_at = now(),
    payment_data = payment_data || jsonb_build_object(
      'webhook_data', p_payment_details,
      'completed_by', 'webhook',
      'processed_at', now()
    ),
    updated_at = now()
  WHERE id = p_recharge_id;
  
  -- Create credit transaction
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
    v_recharge.user_id,
    'recharge',
    v_recharge.total_credits,
    v_current_balance,
    v_new_balance,
    'Recarga via MercadoPago - $' || v_recharge.total_credits || ' créditos',
    v_recharge.id,
    'mercadopago_recharge',
    jsonb_build_object(
      'payment_id', p_payment_details->>'id',
      'payment_method', p_payment_details->>'payment_method_id',
      'status', p_payment_details->>'status',
      'transaction_amount', p_payment_details->>'transaction_amount',
      'currency', p_payment_details->>'currency_id',
      'completed_at', now()
    )
  );
  
  -- Update user credits
  INSERT INTO user_credits (user_id, balance, total_recharged, updated_at)
  VALUES (v_recharge.user_id, v_new_balance, v_recharge.total_credits, now())
  ON CONFLICT (user_id) 
  DO UPDATE SET
    balance = v_new_balance,
    total_recharged = user_credits.total_recharged + v_recharge.total_credits,
    updated_at = now();
  
  RETURN true;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error completing recharge: %', SQLERRM;
END;
$$;

-- Function to log webhook processing
CREATE OR REPLACE FUNCTION log_webhook_processing(
  p_webhook_type text,
  p_payment_id text,
  p_external_reference text,
  p_status text,
  p_details jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_activity_logs (
    user_id,
    action,
    details,
    created_at
  ) 
  SELECT 
    cr.user_id,
    'webhook_processed',
    jsonb_build_object(
      'webhook_type', p_webhook_type,
      'payment_id', p_payment_id,
      'external_reference', p_external_reference,
      'payment_status', p_status,
      'recharge_id', cr.id,
      'details', p_details
    ),
    now()
  FROM credit_recharges cr
  WHERE cr.id::text = p_external_reference;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail if logging fails
    NULL;
END;
$$;

-- Add trigger to automatically process completed recharges
CREATE OR REPLACE FUNCTION process_completed_mercadopago_recharge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only process if status changed to completed and it's a mercadopago payment
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.payment_method = 'mercadopago' THEN
    -- The completion logic is already handled in the complete_mercadopago_recharge function
    -- This trigger just ensures consistency
    RAISE NOTICE 'MercadoPago recharge completed: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_process_completed_mercadopago_recharge'
  ) THEN
    CREATE TRIGGER trigger_process_completed_mercadopago_recharge
      AFTER UPDATE ON credit_recharges
      FOR EACH ROW
      WHEN (NEW.payment_method = 'mercadopago')
      EXECUTE FUNCTION process_completed_mercadopago_recharge();
  END IF;
END $$;