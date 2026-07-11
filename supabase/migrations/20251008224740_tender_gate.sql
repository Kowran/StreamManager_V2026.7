/*
  # Fix Binance Payment Processing

  1. Database Functions
    - Create function to process confirmed Binance payments
    - Create function to handle credit addition
    - Create function to send notifications

  2. Triggers
    - Add trigger to process payments when status changes to 'paid'
    - Ensure credit transactions are created automatically
    - Ensure notifications are sent

  3. Indexes
    - Add indexes for better performance on payment queries
*/

-- Function to process confirmed Binance payments
CREATE OR REPLACE FUNCTION process_confirmed_binance_payment()
RETURNS TRIGGER AS $$
DECLARE
  current_balance DECIMAL(10,2);
  current_total_recharged DECIMAL(10,2);
  new_balance DECIMAL(10,2);
  new_total_recharged DECIMAL(10,2);
BEGIN
  -- Only process when status changes to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    
    -- Get current user credit balance
    SELECT balance, total_recharged 
    INTO current_balance, current_total_recharged
    FROM user_credits 
    WHERE user_id = NEW.user_id;
    
    -- Set defaults if no record exists
    current_balance := COALESCE(current_balance, 0);
    current_total_recharged := COALESCE(current_total_recharged, 0);
    
    -- Calculate new balances
    new_balance := current_balance + NEW.amount_usd;
    new_total_recharged := current_total_recharged + NEW.amount_usd;
    
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
      NEW.amount_usd,
      current_balance,
      new_balance,
      'Recarga via Binance Pay - $' || NEW.amount_usd::text || ' ' || NEW.asset,
      NEW.id::text,
      'binance_payment',
      jsonb_build_object(
        'order_id', NEW.order_id,
        'payment_method', 'binance',
        'asset', NEW.asset,
        'network', NEW.network,
        'tx_id', NEW.tx_id,
        'confirmed_at', NEW.paid_at,
        'auto_processed', true
      ),
      NOW()
    );
    
    -- Update or create user credit record
    INSERT INTO user_credits (user_id, balance, total_recharged, updated_at)
    VALUES (NEW.user_id, new_balance, new_total_recharged, NOW())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      balance = new_balance,
      total_recharged = new_total_recharged,
      updated_at = NOW();
    
    -- Create success notification
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      priority,
      expires_at,
      created_at,
      updated_at
    ) VALUES (
      NEW.user_id,
      'payment',
      '💰 Recarga Confirmada!',
      'Sua recarga de $' || NEW.amount_usd::text || ' via Binance Pay foi confirmada! Os créditos foram adicionados à sua conta.',
      jsonb_build_object(
        'order_id', NEW.order_id,
        'amount', NEW.amount_usd,
        'payment_method', 'binance',
        'asset', NEW.asset,
        'network', NEW.network,
        'new_balance', new_balance,
        'tx_id', NEW.tx_id
      ),
      'high',
      NOW() + INTERVAL '7 days',
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Processed Binance payment: % - $% credited to user %', NEW.order_id, NEW.amount_usd, NEW.user_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for Binance payments
DROP TRIGGER IF EXISTS trigger_process_confirmed_binance_payment ON binance_payments;
CREATE TRIGGER trigger_process_confirmed_binance_payment
  BEFORE UPDATE ON binance_payments
  FOR EACH ROW
  EXECUTE FUNCTION process_confirmed_binance_payment();

-- Function to update Binance payments updated_at timestamp
CREATE OR REPLACE FUNCTION update_binance_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating timestamp
DROP TRIGGER IF EXISTS trigger_update_binance_payments_updated_at ON binance_payments;
CREATE TRIGGER trigger_update_binance_payments_updated_at
  BEFORE UPDATE ON binance_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_binance_payments_updated_at();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_binance_payments_order_id ON binance_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_binance_payments_status ON binance_payments(status);
CREATE INDEX IF NOT EXISTS idx_binance_payments_user_id ON binance_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_binance_payments_created_at ON binance_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_binance_payments_expires_at ON binance_payments(expires_at) WHERE expires_at IS NOT NULL;

-- Function to manually confirm Binance payment (for admin use)
CREATE OR REPLACE FUNCTION manually_confirm_binance_payment(
  p_order_id TEXT,
  p_tx_id TEXT DEFAULT NULL,
  p_admin_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  payment_record RECORD;
BEGIN
  -- Get payment record
  SELECT * INTO payment_record
  FROM binance_payments
  WHERE order_id = p_order_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found or already processed: %', p_order_id;
  END IF;
  
  -- Update payment status
  UPDATE binance_payments
  SET 
    status = 'paid',
    paid_at = NOW(),
    tx_id = COALESCE(p_tx_id, 'MANUAL_CONFIRM_' || extract(epoch from now())::text),
    webhook_data = webhook_data || jsonb_build_object(
      'manually_confirmed', true,
      'confirmed_by_admin', p_admin_id,
      'confirmed_at', NOW()
    ),
    updated_at = NOW()
  WHERE id = payment_record.id;
  
  -- Log admin action if admin_id provided
  IF p_admin_id IS NOT NULL THEN
    INSERT INTO admin_actions (
      admin_id,
      action,
      target_user_id,
      details
    ) VALUES (
      p_admin_id,
      'manual_payment_confirmation',
      payment_record.user_id,
      jsonb_build_object(
        'payment_id', payment_record.id,
        'order_id', p_order_id,
        'amount', payment_record.amount_usd,
        'payment_method', 'binance',
        'tx_id', COALESCE(p_tx_id, 'MANUAL_CONFIRM')
      )
    );
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to check and process pending Binance payments
CREATE OR REPLACE FUNCTION check_pending_binance_payments()
RETURNS INTEGER AS $$
DECLARE
  processed_count INTEGER := 0;
  payment_record RECORD;
BEGIN
  -- Get all pending payments older than 5 minutes
  FOR payment_record IN 
    SELECT * FROM binance_payments 
    WHERE status = 'pending' 
    AND created_at < NOW() - INTERVAL '5 minutes'
    AND created_at > NOW() - INTERVAL '2 hours'
  LOOP
    -- In a real implementation, you would check Binance API here
    -- For now, we'll just log that we checked
    RAISE NOTICE 'Checking payment: % for user %', payment_record.order_id, payment_record.user_id;
    
    -- Update webhook_data to show we checked
    UPDATE binance_payments
    SET 
      webhook_data = webhook_data || jsonb_build_object(
        'last_auto_check', NOW(),
        'auto_check_count', COALESCE((webhook_data->>'auto_check_count')::integer, 0) + 1
      ),
      updated_at = NOW()
    WHERE id = payment_record.id;
    
    processed_count := processed_count + 1;
  END LOOP;
  
  RETURN processed_count;
END;
$$ LANGUAGE plpgsql;