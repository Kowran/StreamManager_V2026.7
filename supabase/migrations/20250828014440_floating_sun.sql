/*
  # Função para Processar Compras na Loja

  1. Nova Função
    - `process_store_purchase_transaction` - Processa compra completa com débito de créditos
    
  2. Funcionalidades
    - Verifica saldo do usuário
    - Debita créditos
    - Cria pedido
    - Reserva estoque
    - Processa entrega automática
*/

-- Função para processar compra completa na loja
CREATE OR REPLACE FUNCTION process_store_purchase_transaction(
  p_user_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_total_price numeric,
  p_customer_email text
)
RETURNS jsonb AS $$
DECLARE
  v_order_id uuid;
  v_current_balance numeric(10,2);
  v_inventory_item record;
  v_delivery_content jsonb;
  v_product record;
BEGIN
  -- Get product details
  SELECT * INTO v_product
  FROM store_products
  WHERE id = p_product_id AND active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found or inactive';
  END IF;

  -- Check stock
  IF v_product.stock_quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_product.stock_quantity, p_quantity;
  END IF;

  -- Get current user balance
  SELECT COALESCE(balance, 0) INTO v_current_balance
  FROM user_credits
  WHERE user_id = p_user_id;
  
  IF v_current_balance IS NULL THEN
    v_current_balance := 0;
  END IF;

  -- Check if user has sufficient balance
  IF v_current_balance < p_total_price THEN
    RAISE EXCEPTION 'Insufficient balance. Current: %, Required: %', v_current_balance, p_total_price;
  END IF;

  -- Create order
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
    p_product_id,
    p_quantity,
    p_total_price * 5.5, -- Convert to BRL
    p_total_price,
    'pending',
    p_customer_email,
    p_customer_email
  ) RETURNING id INTO v_order_id;

  -- Debit user credits
  IF NOT debit_user_credits(
    p_user_id,
    p_total_price,
    'Compra: ' || v_product.name,
    v_order_id,
    'store_order'
  ) THEN
    RAISE EXCEPTION 'Failed to debit user credits';
  END IF;

  -- Reserve inventory items for this purchase
  FOR i IN 1..p_quantity LOOP
    -- Get an available inventory item
    SELECT * INTO v_inventory_item
    FROM product_inventory
    WHERE product_id = p_product_id 
      AND status = 'available'
    ORDER BY created_at ASC
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No inventory available for product';
    END IF;

    -- Mark as sold
    UPDATE product_inventory
    SET 
      status = 'sold',
      updated_at = now()
    WHERE id = v_inventory_item.id;

    -- Prepare delivery content
    v_delivery_content := jsonb_build_object(
      'email', v_inventory_item.email,
      'password', v_inventory_item.password,
      'instructions', v_inventory_item.instructions,
      'product_name', v_product.name,
      'purchase_date', now()
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
      p_product_id,
      p_user_id,
      v_delivery_content,
      'automatic',
      'delivered'
    );
  END LOOP;

  -- Update order status to completed
  UPDATE store_orders
  SET 
    status = 'delivered',
    updated_at = now()
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'amount_debited', p_total_price,
    'new_balance', v_current_balance - p_total_price,
    'items_delivered', p_quantity
  );
END;
$$ LANGUAGE plpgsql;