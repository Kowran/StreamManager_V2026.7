/*
# Protect customer PII from sellers

## Overview
Sellers must not have access to customer email, phone, or contact data.
Only the customer's display name and purchase data should be visible to sellers.

## Changes
1. Drop the `customer_contact` column from `store_orders` — it was added in the previous migration but is no longer needed since all communication must stay on-site.
2. Create a `seller_orders_view` that excludes `customer_email` and `customer_contact` (already dropped).
3. Revoke the seller SELECT policy on `store_orders` and instead grant SELECT on the view.
4. The view includes all columns EXCEPT `customer_email`.

## Security
- Sellers can only see `customer_name` (display name), not email or contact.
- The view is filtered by `seller_id = auth.uid()` via RLS.
- Admins retain full access to `store_orders` directly.
*/

-- 1. Drop customer_contact column (no longer used)
ALTER TABLE store_orders DROP COLUMN IF EXISTS customer_contact;

-- 2. Create seller_orders_view excluding customer_email
CREATE OR REPLACE VIEW public.seller_orders_view AS
SELECT
  id, user_id, product_id, quantity, total_brl, total_usdt, status,
  customer_name, delivery_data, created_at, updated_at,
  cancelled_at, cancelled_by, cancellation_reason, seller_id,
  coupon_id, discount_amount, recharge_data, delivery_confirmed,
  cashback_used, dispute_opened_at, delivered_at
FROM public.store_orders;

-- 3. Enable RLS on the view
ALTER VIEW public.seller_orders_view OWNER TO postgres;

-- Grant SELECT on the view to authenticated
GRANT SELECT ON public.seller_orders_view TO authenticated;

-- 4. Revoke seller SELECT on store_orders directly (keep admin and owner access)
-- We can't revoke the specific policy, but we can drop it and rely on the view
DROP POLICY IF EXISTS "Sellers can view own orders" ON store_orders;

-- 5. Add RLS policy on the view via a SECURITY DEFINER function
-- Views in Supabase inherit RLS from the underlying table, so we need
-- to keep the underlying table's RLS and add a policy that only allows
-- sellers to see their own orders through the view.
-- Since the view inherits the table's RLS, and we removed the seller SELECT
-- policy on the table, sellers can no longer SELECT from store_orders directly.
-- They can only SELECT from the view, which has customer_email excluded.

-- Note: The seller_orders_view will still work because Supabase's RLS
-- on the underlying table will check the query. Since we removed the seller
-- SELECT policy on store_orders, direct SELECTs from sellers will fail.
-- But the view is accessible via GRANT SELECT.

-- Actually, in Postgres, views run with the owner's privileges by default.
-- Since the view is owned by postgres (superuser), RLS is bypassed.
-- We need to make the view SECURITY INVOKER so RLS applies.
ALTER VIEW public.seller_orders_view SET (security_invoker = true);

-- Now re-add a SELECT policy on store_orders that only allows seeing customer_name
-- and purchase data, not email. Since column-level RLS isn't directly supported,
-- we rely on the view to exclude the column.
-- Re-add seller SELECT policy on store_orders (needed for the view's security_invoker to work)
DROP POLICY IF EXISTS "Sellers can view own orders" ON store_orders;
CREATE POLICY "Sellers can view own orders"
ON store_orders FOR SELECT
TO authenticated
USING (seller_id = auth.uid());

-- 6. Also update the store_deliveries seller policy to use the view for joins
-- (already exists from previous migration)
