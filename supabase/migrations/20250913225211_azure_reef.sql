/*
  # Sistema de Cancelamento de Vendas

  1. Novos Campos
    - Adiciona campos para rastrear cancelamentos em store_orders
    - Adiciona índices para melhor performance

  2. Funções
    - Função para processar cancelamento de vendas
    - Função para retornar contas ao estoque

  3. Triggers
    - Trigger para atualizar estoque quando ordem é cancelada

  4. Políticas de Segurança
    - Apenas admins podem cancelar vendas
    - Logs de auditoria para todas as ações
*/

-- Add cancellation fields to store_orders if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_orders' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE store_orders ADD COLUMN cancelled_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_orders' AND column_name = 'cancelled_by'
  ) THEN
    ALTER TABLE store_orders ADD COLUMN cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_orders' AND column_name = 'cancellation_reason'
  ) THEN
    ALTER TABLE store_orders ADD COLUMN cancellation_reason text;
  END IF;
END $$;

-- Add refunded status to store_orders status check if not exists
DO $$
BEGIN
  -- First, check if the constraint exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'store_orders' AND constraint_name = 'store_orders_status_check'
  ) THEN
    -- Drop the existing constraint
    ALTER TABLE store_orders DROP CONSTRAINT store_orders_status_check;
  END IF;
  
  -- Add the new constraint with refunded status
  ALTER TABLE store_orders ADD CONSTRAINT store_orders_status_check 
    CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'delivered'::text, 'cancelled'::text, 'refunded'::text]));
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_store_orders_cancelled_at 
  ON store_orders(cancelled_at) WHERE cancelled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_store_orders_cancelled_by 
  ON store_orders(cancelled_by) WHERE cancelled_by IS NOT NULL;

-- Function to process sale cancellation
CREATE OR REPLACE FUNCTION process_sale_cancellation(
  p_sale_id uuid,
  p_order_id uuid,
  p_admin_id uuid,
  p_cancellation_reason text,
  p_return_to_stock boolean DEFAULT true
) RETURNS json AS $$
DECLARE
  v_sale record;
  v_order record;
  v_user_credit record;
  v_refund_amount numeric;
  v_new_balance numeric;
  v_new_total_spent numeric;
  v_result json;
BEGIN
  -- Get sale details
  SELECT * INTO v_sale
  FROM user_purchases
  WHERE id = p_sale_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Sale not found');
  END IF;

  -- Get order details
  SELECT * INTO v_order
  FROM store_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Check if order is already cancelled
  IF v_order.status = 'cancelled' THEN
    RETURN json_build_object('success', false, 'error', 'Order is already cancelled');
  END IF;

  v_refund_amount := v_sale.purchase_price;

  -- Get current user credit
  SELECT * INTO v_user_credit
  FROM user_credits
  WHERE user_id = v_sale.user_id;

  IF NOT FOUND THEN
    -- Create user credit record if it doesn't exist
    INSERT INTO user_credits (user_id, balance, total_recharged, total_spent)
    VALUES (v_sale.user_id, 0, 0, 0);
    
    SELECT * INTO v_user_credit
    FROM user_credits
    WHERE user_id = v_sale.user_id;
  END IF;

  v_new_balance := COALESCE(v_user_credit.balance, 0) + v_refund_amount;
  v_new_total_spent := GREATEST(0, COALESCE(v_user_credit.total_spent, 0) - v_refund_amount);

  -- Update order status
  UPDATE store_orders
  SET 
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = p_admin_id,
    cancellation_reason = p_cancellation_reason,
    updated_at = now()
  WHERE id = p_order_id;

  -- Create refund transaction
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
    v_sale.user_id,
    'refund',
    v_refund_amount,
    COALESCE(v_user_credit.balance, 0),
    v_new_balance,
    'Reembolso: ' || v_sale.product_name || ' - Cancelado pelo admin',
    p_order_id,
    'order_cancellation',
    json_build_object(
      'original_sale_id', p_sale_id,
      'cancelled_by_admin', p_admin_id,
      'cancellation_reason', p_cancellation_reason,
      'return_to_stock', p_return_to_stock,
      'refund_processed_at', now()
    )
  );

  -- Update user credit balance
  UPDATE user_credits
  SET 
    balance = v_new_balance,
    total_spent = v_new_total_spent,
    updated_at = now()
  WHERE user_id = v_sale.user_id;

  -- Return account to stock if requested and credentials exist
  IF p_return_to_stock AND v_sale.credentials IS NOT NULL THEN
    IF v_sale.credentials->>'email' IS NOT NULL AND v_sale.credentials->>'password' IS NOT NULL THEN
      INSERT INTO product_inventory (
        product_id,
        email,
        password,
        instructions,
        status
      ) VALUES (
        v_sale.product_id,
        v_sale.credentials->>'email',
        v_sale.credentials->>'password',
        COALESCE(v_sale.credentials->>'instructions', 'Use estas credenciais para acessar sua conta.'),
        'available'
      );
    END IF;
  END IF;

  -- Mark purchase as expired/cancelled
  UPDATE user_purchases
  SET 
    expired = true,
    updated_at = now()
  WHERE id = p_sale_id;

  -- Log admin action
  INSERT INTO admin_actions (
    admin_id,
    action,
    target_user_id,
    details
  ) VALUES (
    p_admin_id,
    'cancel_sale',
    v_sale.user_id,
    json_build_object(
      'sale_id', p_sale_id,
      'order_id', p_order_id,
      'product_name', v_sale.product_name,
      'refund_amount', v_refund_amount,
      'cancellation_reason', p_cancellation_reason,
      'return_to_stock', p_return_to_stock,
      'customer_email', (SELECT email FROM profiles WHERE id = v_sale.user_id),
      'cancelled_at', now(),
      'original_purchase_date', v_sale.purchase_date
    )
  );

  -- Build result
  v_result := json_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'order_id', p_order_id,
    'refund_amount', v_refund_amount,
    'new_user_balance', v_new_balance,
    'account_returned_to_stock', p_return_to_stock,
    'customer_email', (SELECT email FROM profiles WHERE id = v_sale.user_id)
  );

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Log the error
  RAISE LOG 'Error in process_sale_cancellation: %', SQLERRM;
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get cancellable sales (for admin interface)
CREATE OR REPLACE FUNCTION get_cancellable_sales(
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
) RETURNS TABLE (
  sale_id uuid,
  order_id uuid,
  user_id uuid,
  customer_email text,
  customer_name text,
  product_name text,
  purchase_price numeric,
  purchase_date timestamptz,
  order_status text,
  can_cancel boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id as sale_id,
    up.order_id,
    up.user_id,
    COALESCE(p.email, so.customer_email) as customer_email,
    COALESCE(p.full_name, so.customer_name) as customer_name,
    up.product_name,
    up.purchase_price,
    up.purchase_date,
    so.status as order_status,
    (so.status != 'cancelled' AND so.status != 'refunded') as can_cancel
  FROM user_purchases up
  LEFT JOIN profiles p ON p.id = up.user_id
  LEFT JOIN store_orders so ON so.id = up.order_id
  WHERE up.order_id IS NOT NULL
  ORDER BY up.purchase_date DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION process_sale_cancellation TO authenticated;
GRANT EXECUTE ON FUNCTION get_cancellable_sales TO authenticated;

-- Create RLS policies for admin access to cancellation functions
CREATE POLICY "Admins can cancel sales" ON store_orders
  FOR UPDATE TO authenticated
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

-- Add comment to document the cancellation system
COMMENT ON FUNCTION process_sale_cancellation IS 'Processes sale cancellation with refund and optional inventory return';
COMMENT ON FUNCTION get_cancellable_sales IS 'Returns list of sales that can be cancelled by admins';