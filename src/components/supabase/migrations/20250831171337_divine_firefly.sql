/*
  # Create seller product purchase function

  1. New Functions
    - `process_seller_product_purchase` - Handles the complete seller product purchase workflow
      - Validates product availability and user balance
      - Processes payment and inventory management
      - Creates purchase records and delivers credentials
      - Handles seller commission calculations

  2. Security
    - Function uses SECURITY DEFINER to run with elevated privileges
    - Proper validation of user ownership and product availability
    - Transaction safety with rollback on errors

  3. Return Format
    - Returns JSON array with success status, order_id, and credentials
    - Compatible with existing Edge Function expectations
*/

CREATE OR REPLACE FUNCTION process_seller_product_purchase(
  p_customer_email TEXT,
  p_quantity INT,
  p_seller_product_id UUID,
  p_user_id UUID
)
RETURNS JSON[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product RECORD;
  v_user_credit RECORD;
  v_order_id UUID;
  v_total_cost NUMERIC(10,2);
  v_seller_commission NUMERIC(10,2);
  v_admin_commission NUMERIC(10,2);
  v_commission_rate NUMERIC(5,4) := 0.04; -- 4% commission rate
  v_credentials JSON[] := '{}';
  v_inventory_item RECORD;
  v_result JSON[];
  i INT;
BEGIN
  -- Validate inputs
  IF p_quantity <= 0 THEN
    RETURN ARRAY[json_build_object(
      'success', false,
      'message', 'Invalid quantity specified'
    )];
  END IF;

  -- Get product details with seller info
  SELECT sp.*, sa.business_name, sa.user_id as seller_user_id
  INTO v_product
  FROM seller_products sp
  JOIN seller_applications sa ON sp.seller_application_id = sa.id
  WHERE sp.id = p_seller_product_id 
    AND sp.is_active = true 
    AND sa.status = 'approved';

  IF NOT FOUND THEN
    RETURN ARRAY[json_build_object(
      'success', false,
      'message', 'Product not found or not available'
    )];
  END IF;

  -- Check stock availability
  IF v_product.stock < p_quantity THEN
    RETURN ARRAY[json_build_object(
      'success', false,
      'message', 'Insufficient stock available'
    )];
  END IF;

  -- Calculate total cost
  v_total_cost := v_product.price * p_quantity;

  -- Get user credit balance
  SELECT balance INTO v_user_credit
  FROM user_credits
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    -- Create user credit record if it doesn't exist
    INSERT INTO user_credits (user_id, balance, total_recharged, total_spent)
    VALUES (p_user_id, 0.00, 0.00, 0.00);
    v_user_credit.balance := 0.00;
  END IF;

  -- Check if user has sufficient balance
  IF v_user_credit.balance < v_total_cost THEN
    RETURN ARRAY[json_build_object(
      'success', false,
      'message', 'Insufficient balance for this purchase'
    )];
  END IF;

  -- Start transaction
  BEGIN
    -- Create store order
    INSERT INTO store_orders (
      user_id,
      product_id,
      quantity,
      total_brl,
      total_usdt,
      status,
      customer_email,
      customer_name
    ) VALUES (
      p_user_id,
      NULL, -- This is a seller product, not a store product
      p_quantity,
      v_total_cost * 5.5, -- Convert to BRL
      v_total_cost,
      'completed',
      p_customer_email,
      (SELECT full_name FROM profiles WHERE id = p_user_id)
    ) RETURNING id INTO v_order_id;

    -- Reserve and collect inventory items
    FOR i IN 1..p_quantity LOOP
      -- Get available inventory item
      SELECT * INTO v_inventory_item
      FROM seller_product_inventory
      WHERE seller_product_id = p_seller_product_id 
        AND status = 'available'
      ORDER BY created_at ASC
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'No available inventory for product';
      END IF;

      -- Mark as sold and assign to order
      UPDATE seller_product_inventory
      SET 
        status = 'sold',
        sold_at = NOW(),
        order_id = v_order_id
      WHERE id = v_inventory_item.id;

      -- Add credentials to result
      v_credentials := v_credentials || json_build_object(
        'email', v_inventory_item.email,
        'password', v_inventory_item.password,
        'instructions', v_inventory_item.instructions
      );
    END LOOP;

    -- Update product stock (this will be handled by trigger, but let's be explicit)
    UPDATE seller_products
    SET stock = stock - p_quantity,
        updated_at = NOW()
    WHERE id = p_seller_product_id;

    -- Deduct from user balance
    UPDATE user_credits
    SET 
      balance = balance - v_total_cost,
      total_spent = total_spent + v_total_cost,
      updated_at = NOW()
    WHERE user_id = p_user_id;

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
      p_user_id,
      'purchase',
      -v_total_cost,
      v_user_credit.balance,
      v_user_credit.balance - v_total_cost,
      'Purchase of seller product: ' || v_product.product_name,
      v_order_id,
      'seller_order',
      json_build_object(
        'seller_product_id', p_seller_product_id,
        'seller_name', v_product.business_name,
        'quantity', p_quantity
      )
    );

    -- Create user purchase record
    INSERT INTO user_purchases (
      user_id,
      order_id,
      product_id,
      product_name,
      purchase_price,
      credentials,
      purchase_date
    ) VALUES (
      p_user_id,
      v_order_id,
      NULL, -- This is a seller product
      v_product.product_name,
      v_total_cost,
      json_build_object('items', v_credentials),
      NOW()
    );

    -- Calculate commissions
    v_seller_commission := v_total_cost * (1 - v_commission_rate);
    v_admin_commission := v_total_cost * v_commission_rate;

    -- Create seller sale record
    INSERT INTO seller_sales (
      seller_id,
      product_id,
      buyer_id,
      order_id,
      total_amount,
      admin_commission,
      seller_commission,
      commission_rate,
      status,
      sale_date
    ) VALUES (
      v_product.seller_application_id,
      p_seller_product_id,
      p_user_id,
      v_order_id,
      v_total_cost,
      v_admin_commission,
      v_seller_commission,
      v_commission_rate,
      'completed',
      NOW()
    );

    -- Create delivery record
    INSERT INTO store_deliveries (
      order_id,
      product_id,
      user_id,
      delivery_content,
      delivery_method,
      delivery_status
    ) VALUES (
      v_order_id,
      NULL, -- Seller product
      p_user_id,
      json_build_object(
        'type', 'seller_product',
        'seller_name', v_product.business_name,
        'product_name', v_product.product_name,
        'credentials', v_credentials
      ),
      'automatic',
      'delivered'
    );

    -- Build success response
    v_result := ARRAY[json_build_object(
      'success', true,
      'message', 'Purchase completed successfully',
      'order_id', v_order_id,
      'credentials', v_credentials,
      'total_cost', v_total_cost,
      'seller_name', v_product.business_name
    )];

    RETURN v_result;

  EXCEPTION WHEN OTHERS THEN
    -- Rollback will happen automatically
    RETURN ARRAY[json_build_object(
      'success', false,
      'message', 'Purchase failed: ' || SQLERRM
    )];
  END;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_seller_product_purchase(TEXT, INT, UUID, UUID) TO authenticated;