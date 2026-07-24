/*
# Preserve seller sales count when products are deleted

## Problem
When a seller deletes a product, the `store_orders.product_id` foreign key
has `ON DELETE CASCADE`, which deletes all orders for that product. This
reduces the seller's total sales count shown on their profile, even though
those sales actually happened.

## Changes
1. Drop the existing `store_orders_product_id_fkey` constraint.
2. Recreate it with `ON DELETE SET NULL` so orders persist after product
   deletion (product_id becomes NULL, but the order record — and its
   commission — remain intact).
3. Update `get_seller_sales_count` to count orders by `seller_id` only,
   without requiring a join to `store_products`. This already works because
   the function filters on `seller_id`, but confirming it remains correct
   after the FK change.

## Security
- No RLS policy changes.
- No new tables or columns.
*/

-- 1. Change FK from CASCADE to SET NULL so orders survive product deletion
ALTER TABLE store_orders DROP CONSTRAINT IF EXISTS store_orders_product_id_fkey;
ALTER TABLE store_orders ADD CONSTRAINT store_orders_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES store_products(id) ON DELETE SET NULL;

-- 2. Re-grant (permissions unchanged)
-- (No function changes needed; get_seller_sales_count already filters by seller_id)
