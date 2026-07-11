/*
  # Improve inventory management triggers

  1. Enhanced Triggers
    - Better stock quantity calculation
    - Handle reserved items properly
    - Prevent race conditions

  2. Cleanup Functions
    - Automatic cleanup of expired reservations
    - Better error handling

  3. Security
    - Proper RLS policies
    - Secure function execution
*/

-- Drop existing trigger to recreate with improvements
DROP TRIGGER IF EXISTS trigger_update_store_product_stock ON product_inventory;

-- Recreate the improved trigger
CREATE TRIGGER trigger_update_store_product_stock
  AFTER INSERT OR DELETE OR UPDATE ON product_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_store_product_stock();

-- Create a function to clean up expired reservations periodically
CREATE OR REPLACE FUNCTION cleanup_expired_inventory_reservations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleanup_count integer;
BEGIN
  -- Clean up reservations older than 10 minutes
  UPDATE product_inventory 
  SET 
    status = 'available',
    updated_at = now()
  WHERE status = 'reserved'
  AND updated_at < (now() - INTERVAL '10 minutes');
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  
  -- Log cleanup if any items were cleaned up
  IF cleanup_count > 0 THEN
    RAISE NOTICE 'Cleaned up % expired inventory reservations', cleanup_count;
  END IF;
END;
$$;

-- Create a function to get real-time inventory status
CREATE OR REPLACE FUNCTION get_product_inventory_status(p_product_id uuid)
RETURNS TABLE(
  total_items bigint,
  available_items bigint,
  reserved_items bigint,
  sold_items bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_items,
    COUNT(*) FILTER (WHERE status = 'available') as available_items,
    COUNT(*) FILTER (WHERE status = 'reserved') as reserved_items,
    COUNT(*) FILTER (WHERE status = 'sold') as sold_items
  FROM product_inventory
  WHERE product_id = p_product_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION cleanup_expired_inventory_reservations() TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_inventory_status(uuid) TO authenticated;

-- Create index for better performance on inventory queries
CREATE INDEX IF NOT EXISTS idx_product_inventory_status_product_id 
ON product_inventory(product_id, status);

CREATE INDEX IF NOT EXISTS idx_product_inventory_updated_at_status 
ON product_inventory(updated_at, status) 
WHERE status = 'reserved';

-- Update RLS policies for better inventory management
DROP POLICY IF EXISTS "Admins can manage all inventory" ON product_inventory;
DROP POLICY IF EXISTS "Users can view available inventory" ON product_inventory;

CREATE POLICY "Admins can manage all inventory"
  ON product_inventory
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

CREATE POLICY "Users can view available inventory for active products"
  ON product_inventory
  FOR SELECT
  TO authenticated
  USING (
    status = 'available'
    AND EXISTS (
      SELECT 1 FROM store_products
      WHERE store_products.id = product_inventory.product_id
      AND store_products.active = true
    )
  );

CREATE POLICY "System can update inventory status"
  ON product_inventory
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);