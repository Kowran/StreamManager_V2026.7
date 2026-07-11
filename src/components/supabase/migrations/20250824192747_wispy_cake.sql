/*
  # Add payment status check function

  1. New Functions
    - `check_pending_payments()` - Function to check and update pending payment statuses
    - Automatically completes demo payments after timeout
    - Handles payment status verification

  2. Security
    - Function runs with security definer privileges
    - Only processes payments that meet specific criteria
*/

-- Function to check and update pending payment statuses
CREATE OR REPLACE FUNCTION check_pending_payments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update demo PIX payments that are older than 15 seconds to completed
  UPDATE credit_recharges 
  SET 
    status = 'completed',
    completed_at = NOW(),
    payment_data = payment_data || jsonb_build_object(
      'auto_completed', true,
      'completion_reason', 'demo_timeout',
      'completed_at', NOW()
    )
  WHERE 
    status = 'pending' 
    AND payment_method = 'mercadopago'
    AND (payment_data->>'mercadopago_payment_id') LIKE 'demo_pix_%'
    AND created_at < NOW() - INTERVAL '15 seconds';

  -- Update demo crypto payments that are older than 15 seconds to completed  
  UPDATE credit_recharges 
  SET 
    status = 'completed',
    completed_at = NOW(),
    payment_data = payment_data || jsonb_build_object(
      'auto_completed', true,
      'completion_reason', 'demo_timeout',
      'completed_at', NOW()
    )
  WHERE 
    status = 'pending' 
    AND payment_method = 'cryptomus'
    AND (payment_data->>'cryptomus_uuid') LIKE 'demo_%'
    AND created_at < NOW() - INTERVAL '15 seconds';
END;
$$;

-- Create a trigger to automatically process completed recharges
CREATE OR REPLACE FUNCTION process_completed_recharge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance NUMERIC(10,2);
  current_total_recharged NUMERIC(10,2);
  new_balance NUMERIC(10,2);
BEGIN
  -- Only process if status changed to completed
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    -- Get current user credit
    SELECT balance, total_recharged 
    INTO current_balance, current_total_recharged
    FROM user_credits 
    WHERE user_id = NEW.user_id;
    
    -- Set defaults if no record exists
    current_balance := COALESCE(current_balance, 0);
    current_total_recharged := COALESCE(current_total_recharged, 0);
    new_balance := current_balance + NEW.total_credits;
    
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
      metadata,
      created_at
    ) VALUES (
      NEW.user_id,
      'recharge',
      NEW.total_credits,
      current_balance,
      new_balance,
      CASE 
        WHEN NEW.payment_method = 'mercadopago' THEN 'Recarga via PIX/Cartão - $' || NEW.total_credits || ' créditos'
        WHEN NEW.payment_method = 'cryptomus' THEN 'Recarga via Crypto - $' || NEW.total_credits || ' créditos'
        ELSE 'Recarga - $' || NEW.total_credits || ' créditos'
      END,
      NEW.id,
      NEW.payment_method || '_recharge',
      jsonb_build_object(
        'payment_method', NEW.payment_method,
        'amount_brl', NEW.amount_brl,
        'amount_usdt', NEW.amount_usdt,
        'auto_processed', true
      ),
      NOW()
    );
    
    -- Update or create user credits
    INSERT INTO user_credits (
      user_id,
      balance,
      total_recharged,
      total_spent,
      created_at,
      updated_at
    ) VALUES (
      NEW.user_id,
      new_balance,
      current_total_recharged + NEW.total_credits,
      0,
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
      balance = new_balance,
      total_recharged = current_total_recharged + NEW.total_credits,
      updated_at = NOW();
      
    RAISE NOTICE 'Recharge processed: user_id=%, amount=%, new_balance=%', NEW.user_id, NEW.total_credits, new_balance;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic recharge processing
DROP TRIGGER IF EXISTS trigger_process_completed_recharge ON credit_recharges;
CREATE TRIGGER trigger_process_completed_recharge
  AFTER UPDATE ON credit_recharges
  FOR EACH ROW
  EXECUTE FUNCTION process_completed_recharge();