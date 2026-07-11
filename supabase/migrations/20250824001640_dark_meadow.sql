/*
  # Update Stock and Delivery System

  1. Database Functions
    - Create function to automatically deliver accounts when purchased
    - Create function to update stock quantities
    - Create trigger to handle automatic delivery

  2. Security
    - Ensure proper RLS policies for stock management
    - Add policies for delivery tracking

  3. Stock Management
    - Update stock tracking for sold items
    - Ensure proper inventory management
*/

-- Function to get next available account for a product
CREATE OR REPLACE FUNCTION get_next_available_account(product_uuid uuid)
RETURNS TABLE (
  account_id uuid,
  email text,
  password text,
  instructions text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    psl.id,
    psl.email,
    psl.password,
    psl.instructions
  FROM product_stock_lines psl
  WHERE psl.product_id = product_uuid
    AND psl.status = 'available'
  ORDER BY psl.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark account as sold and update stock
CREATE OR REPLACE FUNCTION mark_account_sold(
  account_uuid uuid,
  order_uuid uuid
) RETURNS boolean AS $$
DECLARE
  product_uuid uuid;
  current_stock integer;
BEGIN
  -- Get product ID from the account
  SELECT product_id INTO product_uuid
  FROM product_stock_lines
  WHERE id = account_uuid;

  -- Mark account as sold
  UPDATE product_stock_lines
  SET 
    status = 'sold',
    sold_at = now(),
    order_id = order_uuid,
    updated_at = now()
  WHERE id = account_uuid;

  -- Update product stock quantity
  SELECT stock_quantity INTO current_stock
  FROM store_products
  WHERE id = product_uuid;

  UPDATE store_products
  SET 
    stock_quantity = GREATEST(0, current_stock - 1),
    updated_at = now()
  WHERE id = product_uuid;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create automatic delivery
CREATE OR REPLACE FUNCTION create_automatic_delivery(
  order_uuid uuid,
  product_uuid uuid,
  user_uuid uuid,
  account_data jsonb
) RETURNS uuid AS $$
DECLARE
  delivery_uuid uuid;
BEGIN
  INSERT INTO store_deliveries (
    order_id,
    product_id,
    user_id,
    delivery_content,
    delivery_method,
    delivery_status,
    delivered_at
  ) VALUES (
    order_uuid,
    product_uuid,
    user_uuid,
    account_data,
    'automatic',
    'delivered',
    now()
  ) RETURNING id INTO delivery_uuid;

  RETURN delivery_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle automatic account delivery when order is paid
CREATE OR REPLACE FUNCTION handle_automatic_delivery()
RETURNS TRIGGER AS $$
DECLARE
  product_record record;
  account_record record;
  delivery_content jsonb;
BEGIN
  -- Only process when order status changes to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    
    -- Get product information
    SELECT * INTO product_record
    FROM store_products
    WHERE id = NEW.product_id;

    -- Only process if auto_delivery is enabled and it's not the special access product
    IF product_record.auto_delivery = true AND product_record.name != 'Accounts Manager Access' THEN
      
      -- Get next available account
      SELECT * INTO account_record
      FROM get_next_available_account(NEW.product_id);

      IF account_record.account_id IS NOT NULL THEN
        -- Mark account as sold
        PERFORM mark_account_sold(account_record.account_id, NEW.id);

        -- Prepare delivery content
        delivery_content := jsonb_build_object(
          'product_name', product_record.name,
          'description', product_record.description,
          'account_credentials', jsonb_build_object(
            'email', account_record.email,
            'password', account_record.password,
            'instructions', COALESCE(account_record.instructions, 'Use estas credenciais para acessar sua conta.')
          ),
          'delivery_date', now(),
          'purchase_date', NEW.created_at,
          'service_type', 'streaming',
          'stock_line_id', account_record.account_id,
          'automatic_delivery', true
        );

        -- Create delivery record
        PERFORM create_automatic_delivery(
          NEW.id,
          NEW.product_id,
          NEW.user_id,
          delivery_content
        );

        -- Update order status to delivered
        UPDATE store_orders
        SET 
          status = 'delivered',
          updated_at = now()
        WHERE id = NEW.id;

      ELSE
        -- No stock available - create pending delivery
        delivery_content := jsonb_build_object(
          'product_name', product_record.name,
          'description', product_record.description,
          'instructions', 'Produto temporariamente em falta de estoque. Entraremos em contato em breve com suas credenciais de acesso.',
          'purchase_date', NEW.created_at,
          'service_type', 'streaming',
          'out_of_stock', true,
          'pending_delivery', true
        );

        -- Create pending delivery record
        INSERT INTO store_deliveries (
          order_id,
          product_id,
          user_id,
          delivery_content,
          delivery_method,
          delivery_status
        ) VALUES (
          NEW.id,
          NEW.product_id,
          NEW.user_id,
          delivery_content,
          'manual',
          'pending'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic delivery
DROP TRIGGER IF EXISTS trigger_automatic_delivery ON store_orders;
CREATE TRIGGER trigger_automatic_delivery
  AFTER UPDATE ON store_orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_automatic_delivery();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_next_available_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_account_sold(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_automatic_delivery(uuid, uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_automatic_delivery() TO authenticated;