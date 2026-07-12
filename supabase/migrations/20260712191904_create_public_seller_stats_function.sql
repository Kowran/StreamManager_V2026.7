/*
# Create public seller stats functions

1. Purpose
   - Regular users cannot count store_orders due to RLS (they can only see their own orders).
   - These SECURITY DEFINER functions bypass RLS to return public aggregate stats
     (total completed sales count) for a given seller or for admin products.
   - Used by PublicSellerProfile and Store product cards so anyone can see correct counts.

2. New Functions
   - `get_seller_sales_count(seller_uuid uuid)` — counts delivered/paid/processing orders
     for a specific seller_id. Returns bigint.
   - `get_admin_sales_count()` — counts delivered/paid/processing orders where seller_id IS NULL
     (admin products). Returns bigint.

3. Security
   - Both functions are SECURITY DEFINER so they run with the role of their owner (postgres)
     and bypass row-level security on store_orders.
   - Granted to anon and authenticated so the frontend anon-key client can call them via .rpc().
*/

CREATE OR REPLACE FUNCTION get_seller_sales_count(seller_uuid uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM store_orders
  WHERE seller_id = seller_uuid
    AND status IN ('delivered', 'paid', 'processing');
$$;

CREATE OR REPLACE FUNCTION get_admin_sales_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM store_orders
  WHERE seller_id IS NULL
    AND status IN ('delivered', 'paid', 'processing');
$$;

GRANT EXECUTE ON FUNCTION get_seller_sales_count(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_admin_sales_count() TO anon, authenticated;
