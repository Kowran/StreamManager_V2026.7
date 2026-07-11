/*
  # Create inventory reservation function

  1. New Functions
    - `reserve_product_inventory` - Atomically reserves an available inventory item
    - Ensures thread-safe inventory management
    - Prevents race conditions during concurrent purchases

  2. Security
    - Function uses SECURITY DEFINER to run with elevated privileges
    - Validates user authentication
    - Ensures only available items can be reserved

  3. Features
    - Atomic inventory reservation
    - Automatic stock quantity updates
    - Race condition prevention
    - Proper error handling
*/

-- Create function to atomically reserve inventory
CREATE OR REPLACE FUNCTION reserve_product_inventory(
  p_product_id uuid,
  p_user_id uuid
)
RETURNS TABLE(
  id uuid,
  product_id uuid,
  email text,
  password text,
  instructions text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inventory_item RECORD;
BEGIN
  -- Check if user is authenticated
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User authentication required';
  END IF;

  -- Check if product exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM store_products 
    WHERE store_products.id = p_product_id 
    AND active = true
  ) THEN
    RAISE EXCEPTION 'Product not found or inactive';
  END IF;

  -- Atomically reserve the first available inventory item
  UPDATE product_inventory 
  SET 
    status = 'reserved',
    updated_at = now()
  WHERE product_inventory.id = (
    SELECT product_inventory.id
    FROM product_inventory
    WHERE product_inventory.product_id = p_product_id
    AND product_inventory.status = 'available'
    ORDER BY product_inventory.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING 
    product_inventory.id,
    product_inventory.product_id,
    product_inventory.email,
    product_inventory.password,
    product_inventory.instructions,
    product_inventory.status,
    product_inventory.created_at,
    product_inventory.updated_at
  INTO v_inventory_item;

  -- Check if we successfully reserved an item
  IF v_inventory_item.id IS NULL THEN
    RAISE EXCEPTION 'No inventory available for this product';
  END IF;

  -- Return the reserved item
  RETURN QUERY SELECT 
    v_inventory_item.id,
    v_inventory_item.product_id,
    v_inventory_item.email,
    v_inventory_item.password,
    v_inventory_item.instructions,
    v_inventory_item.status,
    v_inventory_item.created_at,
    v_inventory_item.updated_at;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION reserve_product_inventory(uuid, uuid) TO authenticated;

-- Create function to unreserve inventory (for failed purchases)
CREATE OR REPLACE FUNCTION unreserve_product_inventory(
  p_inventory_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update inventory status back to available
  UPDATE product_inventory 
  SET 
    status = 'available',
    updated_at = now()
  WHERE id = p_inventory_id
  AND status = 'reserved';

  -- Return true if update was successful
  RETURN FOUND;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION unreserve_product_inventory(uuid) TO authenticated;

-- Create function to mark inventory as sold
CREATE OR REPLACE FUNCTION mark_inventory_sold(
  p_inventory_id uuid,
  p_order_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update inventory status to sold
  UPDATE product_inventory 
  SET 
    status = 'sold',
    updated_at = now()
  WHERE id = p_inventory_id
  AND status = 'reserved';

  -- Return true if update was successful
  RETURN FOUND;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION mark_inventory_sold(uuid, uuid) TO authenticated;

-- Improve the existing trigger function to handle reserved items
CREATE OR REPLACE FUNCTION update_store_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stock quantity based on available inventory count
  UPDATE store_products 
  SET 
    stock_quantity = (
      SELECT COUNT(*)
      FROM product_inventory
      WHERE product_inventory.product_id = COALESCE(NEW.product_id, OLD.product_id)
      AND product_inventory.status = 'available'
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create a cleanup function for expired reservations
CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Release reservations older than 10 minutes
  UPDATE product_inventory 
  SET 
    status = 'available',
    updated_at = now()
  WHERE status = 'reserved'
  AND updated_at < (now() - INTERVAL '10 minutes');
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_expired_reservations() TO authenticated;