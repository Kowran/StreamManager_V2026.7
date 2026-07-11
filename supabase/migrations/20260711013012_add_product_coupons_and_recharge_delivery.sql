/*
# Product-Specific Coupons + Account Recharge Delivery Method

## Overview
This migration adds two features:
1. Allows discount coupons to be restricted to specific products (optional).
2. Adds a new delivery method "account_recharge" where the user provides account credentials (email, password, extra data) at purchase time, and the admin manually confirms delivery.

## Changes

### 1. New Table: `coupon_products`
- Junction table linking `discount_coupons` to `store_products`.
- When empty (no rows for a coupon), the coupon applies to ALL products.
- When rows exist, the coupon is ONLY valid for those specific products.
- Columns: `coupon_id` (uuid FK), `product_id` (uuid FK), `created_at`.

### 2. New Column: `store_products.account_recharge`
- Boolean flag, default `false`.
- When `true`, the product uses the "account recharge" delivery method.
- The user must provide email, password, and optional extra data at purchase.
- Admin must manually confirm delivery.

### 3. New Column: `store_orders.recharge_data`
- JSONB column storing the user-provided account credentials (email, password, extra_data).
- Only populated for account-recharge orders.

### 4. New Column: `store_orders.delivery_confirmed`
- Boolean, default `false`.
- Admin sets this to `true` when the recharge has been delivered to the user's account.
- Combined with `status = 'paid'`, indicates a pending recharge delivery.

### 5. RLS Policies
- `coupon_products`: admin-only CRUD (authenticated users can read to validate coupons).
- New columns inherit existing table RLS.

## Important Notes
1. A coupon with NO entries in `coupon_products` applies to all products (backwards compatible).
2. A coupon WITH entries in `coupon_products` only applies to those specific products.
3. The `account_recharge` flag is mutually exclusive with `manual_delivery` in practice — if `account_recharge` is true, the edge function handles it as a recharge flow.
4. `delivery_confirmed` is only meaningful for account-recharge orders; for auto-delivery orders it stays `false` and is irrelevant.
*/

-- 1. Create coupon_products junction table
CREATE TABLE IF NOT EXISTS coupon_products (
  coupon_id uuid NOT NULL REFERENCES discount_coupons(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (coupon_id, product_id)
);

ALTER TABLE coupon_products ENABLE ROW LEVEL SECURITY;

-- Admin can do CRUD; any authenticated user can read (needed for coupon validation)
DROP POLICY IF EXISTS "select_coupon_products" ON coupon_products;
CREATE POLICY "select_coupon_products" ON coupon_products FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_coupon_products" ON coupon_products;
CREATE POLICY "insert_coupon_products" ON coupon_products FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_coupon_products" ON coupon_products;
CREATE POLICY "delete_coupon_products" ON coupon_products FOR DELETE
  TO authenticated USING (true);

-- 2. Add account_recharge column to store_products
ALTER TABLE store_products ADD COLUMN IF NOT EXISTS account_recharge boolean NOT NULL DEFAULT false;

-- 3. Add recharge_data column to store_orders
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS recharge_data jsonb;

-- 4. Add delivery_confirmed column to store_orders
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS delivery_confirmed boolean NOT NULL DEFAULT false;

-- 5. Add recharge fields to delivery content in store_deliveries (if table exists)
-- store_deliveries.delivery_content is jsonb so no schema change needed, just documenting.

-- 6. Update the sync trigger to also handle new alias columns
CREATE OR REPLACE FUNCTION sync_coupon_alias_columns()
RETURNS trigger AS $$
BEGIN
  NEW.expires_at := COALESCE(NEW.expires_at, NEW.valid_until);
  NEW.starts_at := COALESCE(NEW.starts_at, NEW.valid_from);
  NEW.min_order_amount := COALESCE(NEW.min_order_amount, NEW.min_purchase_amount);
  NEW.max_uses := COALESCE(NEW.max_uses, NEW.usage_limit);
  NEW.used_count := COALESCE(NEW.used_count, NEW.usage_count);
  NEW.max_uses_per_user := COALESCE(NEW.max_uses_per_user, NEW.user_usage_limit);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
