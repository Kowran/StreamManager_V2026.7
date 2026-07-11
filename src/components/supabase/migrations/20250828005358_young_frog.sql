/*
  # Fix PIX Payment System

  1. Improvements
    - Add better indexing for payment status checks
    - Improve RPC functions for payment completion
    - Add automatic payment completion for demo payments
    - Enhanced notification system for payment updates

  2. New Functions
    - `complete_demo_payment` - Completes demo payments automatically
    - `check_pending_payments` - Checks and updates pending payment status
    - `create_notification` - Enhanced notification creation

  3. Triggers
    - Enhanced payment completion triggers
    - Better error handling for payment processing
*/

-- Create function to complete demo payments automatically
CREATE OR REPLACE FUNCTION complete_demo_payment(p_recharge_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recharge record;
  v_current_credit record;
  v_new_balance numeric(10,2);
BEGIN
  -- Get recharge record
  SELECT * INTO v_recharge
  FROM credit_recharges
  WHERE id = p_recharge_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Get current user credit
  SELECT balance, total_recharged INTO v_current_credit
  FROM user_credits
  WHERE user_id = v_recharge.user_id;
  
  -- Calculate new balance
  v_new_balance := COALESCE(v_current_credit.balance, 0) + v_recharge.total_credits;
  
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
    COALESCE(v_current_credit.balance, 0),
    v_new_balance,
    'Recarga via PIX (Demo) - $' || v_recharge.total_credits || ' créditos',
    v_recharge.id,
    'demo_pix_payment',
    jsonb_build_object(
      'demo_mode', true,
      'payment_method', 'pix',
      'completed_at', now(),
      'auto_completed', true
    )
  );
  
  -- Update user credits
  INSERT INTO user_credits (user_id, balance, total_recharged, updated_at)
  VALUES (v_recharge.user_id, v_new_balance, COALESCE(v_current_credit.total_recharged, 0) + v_recharge.total_credits, now())
  ON CONFLICT (user_id) DO UPDATE SET
    balance = v_new_balance,
    total_recharged = COALESCE(user_credits.total_recharged, 0) + v_recharge.total_credits,
    updated_at = now();
  
  -- Update recharge status
  UPDATE credit_recharges
  SET 
    status = 'completed',
    completed_at = now(),
    payment_data = payment_data || jsonb_build_object(
      'completed_by', 'demo_system',
      'completion_method', 'auto_demo',
      'credits_added', v_recharge.total_credits,
      'new_balance', v_new_balance
    )
  WHERE id = p_recharge_id;
  
  RETURN true;
END;
$$;

-- Create function to check and auto-complete pending demo payments
CREATE OR REPLACE FUNCTION check_pending_demo_payments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recharge record;
  v_completed_count integer := 0;
BEGIN
  -- Find pending demo payments older than 10 seconds
  FOR v_recharge IN
    SELECT id, created_at, payment_data
    FROM credit_recharges
    WHERE status = 'pending'
      AND payment_method = 'mercadopago'
      AND payment_data->>'demo_mode' = 'true'
      AND created_at < now() - interval '10 seconds'
  LOOP
    -- Complete the demo payment
    IF complete_demo_payment(v_recharge.id) THEN
      v_completed_count := v_completed_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_completed_count;
END;
$$;

-- Enhanced notification creation function
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_type notification_type,
  p_title text,
  p_message text,
  p_data jsonb DEFAULT '{}',
  p_priority notification_priority DEFAULT 'medium',
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id uuid;
  v_preferences record;
BEGIN
  -- Get user notification preferences
  SELECT * INTO v_preferences
  FROM notification_preferences
  WHERE user_id = p_user_id;
  
  -- Check if this type of notification is enabled
  IF v_preferences IS NOT NULL THEN
    CASE p_type
      WHEN 'account_expiry' THEN
        IF NOT v_preferences.account_expiry_enabled THEN
          RETURN NULL;
        END IF;
      WHEN 'delivery' THEN
        IF NOT v_preferences.delivery_enabled THEN
          RETURN NULL;
        END IF;
      WHEN 'payment' THEN
        IF NOT v_preferences.payment_enabled THEN
          RETURN NULL;
        END IF;
      WHEN 'support' THEN
        IF NOT v_preferences.support_enabled THEN
          RETURN NULL;
        END IF;
      WHEN 'system' THEN
        IF NOT v_preferences.system_enabled THEN
          RETURN NULL;
        END IF;
      WHEN 'admin' THEN
        IF NOT v_preferences.admin_enabled THEN
          RETURN NULL;
        END IF;
      WHEN 'accounts_access_expiry' THEN
        IF NOT v_preferences.accounts_access_expiry_enabled THEN
          RETURN NULL;
        END IF;
      ELSE
        -- Allow other types by default
    END CASE;
  END IF;
  
  -- Create the notification
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    priority,
    expires_at,
    read,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_data,
    p_priority,
    p_expires_at,
    false,
    now(),
    now()
  ) RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Add index for faster payment status checks
CREATE INDEX IF NOT EXISTS idx_credit_recharges_pending_demo 
ON credit_recharges (created_at, status) 
WHERE status = 'pending' AND payment_method = 'mercadopago';

-- Add index for faster user credit lookups
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id_balance 
ON user_credits (user_id, balance);

-- Add index for faster transaction queries
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_reference 
ON credit_transactions (user_id, reference_type, reference_id);

-- Create trigger to auto-complete demo payments
CREATE OR REPLACE FUNCTION trigger_auto_complete_demo_payments()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only for demo payments
  IF NEW.payment_method = 'mercadopago' AND 
     NEW.payment_data->>'demo_mode' = 'true' AND 
     NEW.status = 'pending' THEN
    
    -- Schedule auto-completion after 15 seconds
    PERFORM pg_notify('demo_payment_created', NEW.id::text);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new recharges
DROP TRIGGER IF EXISTS trigger_auto_complete_demo_payments ON credit_recharges;
CREATE TRIGGER trigger_auto_complete_demo_payments
  AFTER INSERT ON credit_recharges
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_complete_demo_payments();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION complete_demo_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION check_pending_demo_payments() TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification(uuid, notification_type, text, text, jsonb, notification_priority, timestamptz) TO authenticated;