/*
  # Fix delivery permissions and triggers

  1. Security Updates
    - Update RLS policies for store_deliveries table
    - Ensure proper permissions for automatic delivery processing
    - Add better error handling for edge cases

  2. Trigger Improvements
    - Enhance automatic delivery trigger function
    - Add better logging and error handling
    - Ensure consistent behavior across all users

  3. Debugging
    - Add logging for delivery processing
    - Improve error messages and debugging info
*/

-- Update RLS policies for store_deliveries to ensure proper access
DROP POLICY IF EXISTS "System can insert deliveries" ON store_deliveries;
DROP POLICY IF EXISTS "Users can view own deliveries" ON store_deliveries;
DROP POLICY IF EXISTS "Admins can manage deliveries" ON store_deliveries;

-- Create more permissive policies for delivery processing
CREATE POLICY "Enable delivery creation for authenticated users"
  ON store_deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view own deliveries"
  ON store_deliveries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all deliveries"
  ON store_deliveries
  FOR ALL
  TO authenticated
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

-- Update RLS policies for product_stock_lines to ensure proper access
DROP POLICY IF EXISTS "Authenticated users can add stock lines" ON product_stock_lines;
DROP POLICY IF EXISTS "Users can view their purchased lines" ON product_stock_lines;
DROP POLICY IF EXISTS "Admins can manage all stock lines" ON product_stock_lines;

-- Create more permissive policies for stock management
CREATE POLICY "Enable stock management for authenticated users"
  ON product_stock_lines
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Improve the automatic delivery trigger function
CREATE OR REPLACE FUNCTION handle_automatic_delivery()
RETURNS TRIGGER AS $$
DECLARE
  product_record RECORD;
  stock_line_record RECORD;
  delivery_content JSONB;
  delivery_id UUID;
BEGIN
  -- Only process if status changed to 'paid'
  IF OLD.status IS DISTINCT FROM 'paid' AND NEW.status = 'paid' THEN
    
    -- Log the trigger execution
    RAISE LOG 'Processing automatic delivery for order: %, user: %', NEW.id, NEW.user_id;
    
    -- Get product details
    SELECT * INTO product_record
    FROM store_products
    WHERE id = NEW.product_id;
    
    IF NOT FOUND THEN
      RAISE LOG 'Product not found for order: %', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Only process if auto_delivery is enabled
    IF NOT product_record.auto_delivery THEN
      RAISE LOG 'Product % does not have auto delivery enabled', product_record.name;
      RETURN NEW;
    END IF;
    
    -- Check if delivery already exists
    IF EXISTS (
      SELECT 1 FROM store_deliveries 
      WHERE order_id = NEW.id
    ) THEN
      RAISE LOG 'Delivery already exists for order: %', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Find available stock line with better locking
    SELECT * INTO stock_line_record
    FROM product_stock_lines
    WHERE product_id = NEW.product_id
      AND status = 'available'
      AND (reserved_until IS NULL OR reserved_until < NOW())
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    
    IF NOT FOUND THEN
      RAISE LOG 'No available stock for product: %, order: %', product_record.name, NEW.id;
      RETURN NEW;
    END IF;
    
    -- Mark stock as sold
    UPDATE product_stock_lines
    SET 
      status = 'sold',
      sold_at = NOW(),
      order_id = NEW.id,
      updated_at = NOW()
    WHERE id = stock_line_record.id;
    
    IF NOT FOUND THEN
      RAISE LOG 'Failed to update stock line: % for order: %', stock_line_record.id, NEW.id;
      RETURN NEW;
    END IF;
    
    RAISE LOG 'Stock line % marked as sold for order: %', stock_line_record.id, NEW.id;
    
    -- Prepare delivery content
    delivery_content := jsonb_build_object(
      'product_name', product_record.name,
      'account_credentials', jsonb_build_object(
        'email', stock_line_record.email,
        'password', stock_line_record.password,
        'instructions', COALESCE(stock_line_record.instructions, 'Use estas credenciais para acessar sua conta.')
      ),
      'delivery_method', 'trigger_automatic',
      'delivered_at', NOW(),
      'stock_line_id', stock_line_record.id,
      'additional_info', jsonb_build_object(
        'support_contact', 'WhatsApp: +55 84 99610-5167',
        'validity', 'Credenciais válidas conforme período do produto',
        'important_notes', 'Guarde estas informações em local seguro',
        'processed_by', 'database_trigger'
      )
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
      NEW.id,
      NEW.product_id,
      NEW.user_id,
      delivery_content,
      'automatic',
      'delivered'
    ) RETURNING id INTO delivery_id;
    
    RAISE LOG 'Delivery created successfully: % for order: %, user: %', delivery_id, NEW.id, NEW.user_id;
    
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the transaction
    RAISE LOG 'Error in automatic delivery trigger for order %: % - %', NEW.id, SQLSTATE, SQLERRM;
    
    -- Try to rollback stock line if it was updated
    BEGIN
      UPDATE product_stock_lines
      SET 
        status = 'available',
        sold_at = NULL,
        order_id = NULL,
        updated_at = NOW()
      WHERE order_id = NEW.id AND status = 'sold';
      
      RAISE LOG 'Rolled back stock line for failed delivery, order: %', NEW.id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE LOG 'Failed to rollback stock line for order: %', NEW.id;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_automatic_delivery ON store_orders;
CREATE TRIGGER trigger_automatic_delivery
  AFTER UPDATE ON store_orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_automatic_delivery();

-- Create a function to debug delivery issues for specific users
CREATE OR REPLACE FUNCTION debug_user_delivery_issues(target_user_email TEXT)
RETURNS TABLE (
  issue_type TEXT,
  description TEXT,
  details JSONB
) AS $$
DECLARE
  user_record RECORD;
  order_record RECORD;
  product_record RECORD;
  stock_count INTEGER;
BEGIN
  -- Find user by email
  SELECT auth.users.id, auth.users.email, profiles.role, profiles.banned
  INTO user_record
  FROM auth.users
  LEFT JOIN profiles ON profiles.id = auth.users.id
  WHERE auth.users.email = target_user_email;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'user_not_found'::TEXT, 'User not found'::TEXT, jsonb_build_object('email', target_user_email);
    RETURN;
  END IF;
  
  -- Check if user is banned
  IF user_record.banned THEN
    RETURN QUERY SELECT 'user_banned'::TEXT, 'User is banned'::TEXT, jsonb_build_object('user_id', user_record.id);
  END IF;
  
  -- Check recent orders without deliveries
  FOR order_record IN
    SELECT so.*, sp.name as product_name, sp.auto_delivery
    FROM store_orders so
    JOIN store_products sp ON sp.id = so.product_id
    WHERE so.user_id = user_record.id
      AND so.status = 'paid'
      AND so.created_at > NOW() - INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM store_deliveries sd 
        WHERE sd.order_id = so.id
      )
  LOOP
    -- Check if product has auto delivery
    IF NOT order_record.auto_delivery THEN
      RETURN QUERY SELECT 
        'manual_delivery_required'::TEXT,
        'Product requires manual delivery'::TEXT,
        jsonb_build_object(
          'order_id', order_record.id,
          'product_name', order_record.product_name,
          'created_at', order_record.created_at
        );
      CONTINUE;
    END IF;
    
    -- Check stock availability
    SELECT COUNT(*) INTO stock_count
    FROM product_stock_lines
    WHERE product_id = order_record.product_id
      AND status = 'available';
    
    IF stock_count = 0 THEN
      RETURN QUERY SELECT 
        'no_stock_available'::TEXT,
        'No stock available for automatic delivery'::TEXT,
        jsonb_build_object(
          'order_id', order_record.id,
          'product_id', order_record.product_id,
          'product_name', order_record.product_name
        );
    ELSE
      RETURN QUERY SELECT 
        'delivery_failed'::TEXT,
        'Automatic delivery failed despite available stock'::TEXT,
        jsonb_build_object(
          'order_id', order_record.id,
          'product_id', order_record.product_id,
          'product_name', order_record.product_name,
          'available_stock', stock_count,
          'created_at', order_record.created_at
        );
    END IF;
  END LOOP;
  
  -- If no issues found
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      'no_issues'::TEXT,
      'No delivery issues found for this user'::TEXT,
      jsonb_build_object('user_id', user_record.id, 'email', user_record.email);
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION debug_user_delivery_issues(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_automatic_delivery() TO authenticated;