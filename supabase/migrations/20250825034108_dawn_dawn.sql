/*
  # Corrigir Sistema de Entrega Automática

  1. Correções na Função de Entrega Automática
    - Corrigir lógica de verificação de produtos com auto_delivery
    - Melhorar tratamento de estoque
    - Adicionar logs para debug
    - Corrigir estrutura do delivery_content

  2. Atualizar Trigger
    - Garantir que o trigger seja executado corretamente
    - Adicionar verificações de segurança

  3. Função de Atualização de Estoque
    - Corrigir contagem de estoque disponível
    - Melhorar performance da query
*/

-- Drop existing function and trigger
DROP TRIGGER IF EXISTS trigger_automatic_delivery ON store_orders;
DROP FUNCTION IF EXISTS handle_automatic_delivery();

-- Create improved automatic delivery function
CREATE OR REPLACE FUNCTION handle_automatic_delivery()
RETURNS TRIGGER AS $$
DECLARE
  product_record RECORD;
  stock_line RECORD;
  delivery_content JSONB;
BEGIN
  -- Only process if order status changed to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    
    -- Get product information
    SELECT * INTO product_record
    FROM store_products 
    WHERE id = NEW.product_id;
    
    -- Check if product exists and has auto delivery enabled
    IF product_record IS NULL THEN
      RAISE LOG 'Product not found for order %', NEW.id;
      RETURN NEW;
    END IF;
    
    IF NOT product_record.auto_delivery THEN
      RAISE LOG 'Product % does not have auto delivery enabled', product_record.name;
      RETURN NEW;
    END IF;
    
    -- Check if delivery already exists
    IF EXISTS (
      SELECT 1 FROM store_deliveries 
      WHERE order_id = NEW.id
    ) THEN
      RAISE LOG 'Delivery already exists for order %', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Get available stock line
    SELECT * INTO stock_line
    FROM product_stock_lines
    WHERE product_id = NEW.product_id 
      AND status = 'available'
      AND reserved_until IS NULL
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF stock_line IS NULL THEN
      RAISE LOG 'No available stock for product %', product_record.name;
      RETURN NEW;
    END IF;
    
    -- Mark stock line as sold
    UPDATE product_stock_lines
    SET 
      status = 'sold',
      sold_at = NOW(),
      order_id = NEW.id
    WHERE id = stock_line.id;
    
    -- Prepare delivery content with proper structure
    delivery_content := jsonb_build_object(
      'product_name', product_record.name,
      'account_credentials', jsonb_build_object(
        'email', stock_line.email,
        'password', stock_line.password,
        'instructions', COALESCE(stock_line.instructions, 'Use estas credenciais para acessar sua conta.')
      ),
      'delivery_info', jsonb_build_object(
        'delivered_at', NOW(),
        'delivery_method', 'automatic',
        'product_category', product_record.category,
        'stock_line_id', stock_line.id
      ),
      'instructions', COALESCE(stock_line.instructions, 'Use estas credenciais para acessar sua conta.'),
      'additional_info', jsonb_build_object(
        'support_contact', '+5584996105167',
        'validity', 'Credenciais válidas por tempo indeterminado',
        'important_notes', 'Guarde estas informações em local seguro'
      )
    );
    
    -- Create delivery record
    INSERT INTO store_deliveries (
      order_id,
      product_id,
      user_id,
      delivery_content,
      delivery_method,
      delivery_status,
      delivered_at
    ) VALUES (
      NEW.id,
      NEW.product_id,
      NEW.user_id,
      delivery_content,
      'automatic',
      'delivered',
      NOW()
    );
    
    RAISE LOG 'Automatic delivery created for order % with stock line %', NEW.id, stock_line.id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER trigger_automatic_delivery
  AFTER UPDATE ON store_orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_automatic_delivery();

-- Create or replace function to update product stock quantity
CREATE OR REPLACE FUNCTION update_product_stock_quantity()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stock quantity based on available stock lines
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    UPDATE store_products
    SET 
      stock_quantity = (
        SELECT COUNT(*)
        FROM product_stock_lines
        WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
          AND status = 'available'
      ),
      updated_at = NOW()
    WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists for stock updates
DROP TRIGGER IF EXISTS trigger_update_product_stock ON product_stock_lines;
CREATE TRIGGER trigger_update_product_stock
  AFTER INSERT OR UPDATE OR DELETE ON product_stock_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_product_stock_quantity();

-- Function to manually process pending orders (for fixing existing orders)
CREATE OR REPLACE FUNCTION process_pending_automatic_deliveries()
RETURNS TABLE(processed_orders INTEGER, failed_orders INTEGER) AS $$
DECLARE
  order_record RECORD;
  processed_count INTEGER := 0;
  failed_count INTEGER := 0;
BEGIN
  -- Find paid orders without deliveries for auto-delivery products
  FOR order_record IN
    SELECT o.*, p.name as product_name, p.auto_delivery
    FROM store_orders o
    JOIN store_products p ON o.product_id = p.id
    WHERE o.status = 'paid'
      AND p.auto_delivery = true
      AND NOT EXISTS (
        SELECT 1 FROM store_deliveries d 
        WHERE d.order_id = o.id
      )
  LOOP
    BEGIN
      -- Simulate the trigger by calling the function
      PERFORM handle_automatic_delivery_for_order(order_record.id);
      processed_count := processed_count + 1;
      
      RAISE LOG 'Processed automatic delivery for order %', order_record.id;
      
    EXCEPTION WHEN OTHERS THEN
      failed_count := failed_count + 1;
      RAISE LOG 'Failed to process order %: %', order_record.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT processed_count, failed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to process individual order
CREATE OR REPLACE FUNCTION handle_automatic_delivery_for_order(order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  order_record RECORD;
  product_record RECORD;
  stock_line RECORD;
  delivery_content JSONB;
BEGIN
  -- Get order details
  SELECT * INTO order_record
  FROM store_orders
  WHERE id = order_id AND status = 'paid';
  
  IF order_record IS NULL THEN
    RAISE LOG 'Order % not found or not paid', order_id;
    RETURN FALSE;
  END IF;
  
  -- Get product information
  SELECT * INTO product_record
  FROM store_products 
  WHERE id = order_record.product_id;
  
  IF product_record IS NULL OR NOT product_record.auto_delivery THEN
    RAISE LOG 'Product % not found or auto delivery disabled', order_record.product_id;
    RETURN FALSE;
  END IF;
  
  -- Check if delivery already exists
  IF EXISTS (SELECT 1 FROM store_deliveries WHERE order_id = order_id) THEN
    RAISE LOG 'Delivery already exists for order %', order_id;
    RETURN TRUE;
  END IF;
  
  -- Get available stock line
  SELECT * INTO stock_line
  FROM product_stock_lines
  WHERE product_id = order_record.product_id 
    AND status = 'available'
    AND reserved_until IS NULL
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF stock_line IS NULL THEN
    RAISE LOG 'No available stock for product %', product_record.name;
    RETURN FALSE;
  END IF;
  
  -- Mark stock line as sold
  UPDATE product_stock_lines
  SET 
    status = 'sold',
    sold_at = NOW(),
    order_id = order_id
  WHERE id = stock_line.id;
  
  -- Prepare delivery content
  delivery_content := jsonb_build_object(
    'product_name', product_record.name,
    'account_credentials', jsonb_build_object(
      'email', stock_line.email,
      'password', stock_line.password,
      'instructions', COALESCE(stock_line.instructions, 'Use estas credenciais para acessar sua conta.')
    ),
    'delivery_info', jsonb_build_object(
      'delivered_at', NOW(),
      'delivery_method', 'automatic',
      'product_category', product_record.category,
      'stock_line_id', stock_line.id
    ),
    'instructions', COALESCE(stock_line.instructions, 'Use estas credenciais para acessar sua conta.'),
    'additional_info', jsonb_build_object(
      'support_contact', '+5584996105167',
      'validity', 'Credenciais válidas por tempo indeterminado',
      'important_notes', 'Guarde estas informações em local seguro'
    )
  );
  
  -- Create delivery record
  INSERT INTO store_deliveries (
    order_id,
    product_id,
    user_id,
    delivery_content,
    delivery_method,
    delivery_status,
    delivered_at
  ) VALUES (
    order_id,
    order_record.product_id,
    order_record.user_id,
    delivery_content,
    'automatic',
    'delivered',
    NOW()
  );
  
  RAISE LOG 'Automatic delivery created for order % with stock line %', order_id, stock_line.id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing paid orders that should have automatic delivery
DO $$
DECLARE
  result_record RECORD;
BEGIN
  SELECT * INTO result_record FROM process_pending_automatic_deliveries();
  RAISE LOG 'Processed % orders, failed %', result_record.processed_orders, result_record.failed_orders;
END $$;