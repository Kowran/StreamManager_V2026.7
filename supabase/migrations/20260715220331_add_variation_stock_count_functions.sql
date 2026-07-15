-- Function to get available stock count per variation
CREATE OR REPLACE FUNCTION get_variation_stock_count(p_variation_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM product_inventory
  WHERE variation_id = p_variation_id AND status = 'available';
$$;

-- Also get total available stock for a product (including variation inventory)
CREATE OR REPLACE FUNCTION get_product_total_stock(p_product_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM product_inventory
  WHERE product_id = p_product_id AND status = 'available';
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION get_variation_stock_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_total_stock(UUID) TO authenticated;
