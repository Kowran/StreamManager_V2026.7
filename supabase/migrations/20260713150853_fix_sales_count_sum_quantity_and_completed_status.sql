/*
# Fix sales count functions to use SUM(quantity) and include 'completed' status

## Problem
The `get_seller_sales_count` and `get_admin_sales_count` functions use
`COUNT(*)` instead of `SUM(quantity)`, so multi-unit purchases (e.g. buying
3 of the same product) count as 1 sale instead of 3. They also exclude
`'completed'` status, which is the most common order status in the database
(1142 out of 1250 orders are 'completed').

The `get_product_sales_count` function has a redundant double filter
(`NOT IN (...) AND IN (...)`) that works but is confusing.

## Changes
1. Update `get_seller_sales_count` to use `SUM(quantity)` and include
   'completed' in the counted statuses.
2. Update `get_admin_sales_count` to use `SUM(quantity)` and include
   'completed' in the counted statuses.
3. Simplify `get_product_sales_count` to use a single clean filter:
   count all orders except cancelled/refunded/disputed.

## Security
- No RLS policy changes.
- All functions remain SECURITY DEFINER with search_path = public.
*/

-- 1. Fix get_seller_sales_count to use SUM(quantity) and include 'completed'
CREATE OR REPLACE FUNCTION get_seller_sales_count(seller_uuid uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(quantity), 0)::bigint
  FROM store_orders
  WHERE seller_id = seller_uuid
    AND status NOT IN ('cancelled', 'refunded', 'disputed');
$$;

-- 2. Fix get_admin_sales_count to use SUM(quantity) and include 'completed'
CREATE OR REPLACE FUNCTION get_admin_sales_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(quantity), 0)::bigint
  FROM store_orders
  WHERE seller_id IS NULL
    AND status NOT IN ('cancelled', 'refunded', 'disputed');
$$;

-- 3. Simplify get_product_sales_count to count all non-cancelled orders
CREATE OR REPLACE FUNCTION get_product_sales_count(product_uuid uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(quantity), 0)::bigint
  FROM store_orders
  WHERE product_id = product_uuid
    AND status NOT IN ('cancelled', 'refunded', 'disputed');
$$;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION get_seller_sales_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_seller_sales_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_admin_sales_count() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_sales_count() TO anon;
GRANT EXECUTE ON FUNCTION get_product_sales_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_sales_count(uuid) TO anon;
