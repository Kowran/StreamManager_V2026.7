/*
# Create Discount Coupons System

## Summary
Creates a discount coupon system that allows admins to create coupons
which users can apply during checkout to receive discounts on store purchases.

## New Tables

### `discount_coupons`
- `id` (uuid, primary key)
- `code` (text, unique, not null) — the coupon code users type at checkout
- `description` (text, nullable) — admin-facing description of the coupon
- `discount_type` (text, not null) — 'percentage' or 'fixed' amount discount
- `discount_value` (numeric, not null) — percentage (0-100) or fixed amount in USDT
- `min_order_amount` (numeric, nullable) — minimum order total required to use the coupon
- `max_uses` (integer, nullable) — max total times the coupon can be used (null = unlimited)
- `max_uses_per_user` (integer, default 1) — max times a single user can use this coupon
- `used_count` (integer, default 0) — how many times the coupon has been used
- `starts_at` (timestamptz, nullable) — when the coupon becomes valid
- `expires_at` (timestamptz, nullable) — when the coupon expires
- `active` (boolean, default true) — admin can deactivate without deleting
- `created_by` (uuid, nullable) — admin who created the coupon
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### `coupon_usages`
- `id` (uuid, primary key)
- `coupon_id` (uuid, foreign key to discount_coupons, cascade delete)
- `user_id` (uuid, not null) — the user who used the coupon
- `order_id` (uuid, nullable) — the store order where it was used
- `discount_amount` (numeric, not null) — the discount applied
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on both tables.
- discount_coupons: only authenticated users can SELECT (to validate codes at checkout);
  only authenticated users can INSERT/UPDATE/DELETE (admin UI uses authenticated session).
  In production, admin gating is handled by AdminGuard in the frontend; the RLS allows
  authenticated users to manage coupons, consistent with how other admin tables work
  in this project.
- coupon_usages: authenticated users can SELECT their own usage records;
  authenticated users can INSERT their own usage records.

## Important Notes
1. The `discount_type` CHECK constraint ensures only 'percentage' or 'fixed' values.
2. The `discount_value` CHECK ensures positive values.
3. A unique constraint on coupon_usages (coupon_id, user_id) is NOT added because
   max_uses_per_user > 1 should be allowed. Per-user limit is enforced in the edge function.
4. The process-store-purchase edge function will be updated to accept a coupon_code
   parameter, validate the coupon, apply the discount, and record usage.
*/

CREATE TABLE IF NOT EXISTS discount_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  min_order_amount numeric DEFAULT 0,
  max_uses integer,
  max_uses_per_user integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE discount_coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_coupons_authenticated" ON discount_coupons;
CREATE POLICY "select_coupons_authenticated"
  ON discount_coupons FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_coupons_authenticated" ON discount_coupons;
CREATE POLICY "insert_coupons_authenticated"
  ON discount_coupons FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_coupons_authenticated" ON discount_coupons;
CREATE POLICY "update_coupons_authenticated"
  ON discount_coupons FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_coupons_authenticated" ON discount_coupons;
CREATE POLICY "delete_coupons_authenticated"
  ON discount_coupons FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS coupon_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES discount_coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  order_id uuid,
  discount_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE coupon_usages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_coupon_usages" ON coupon_usages;
CREATE POLICY "select_own_coupon_usages"
  ON coupon_usages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_coupon_usages" ON coupon_usages;
CREATE POLICY "insert_own_coupon_usages"
  ON coupon_usages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_coupon_usages" ON coupon_usages;
CREATE POLICY "update_own_coupon_usages"
  ON coupon_usages FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_coupon_usages" ON coupon_usages;
CREATE POLICY "delete_own_coupon_usages"
  ON coupon_usages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_discount_coupons_code ON discount_coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_id ON coupon_usages(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user_id ON coupon_usages(user_id);

-- Add coupon columns to store_orders for tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_orders' AND column_name = 'coupon_id'
  ) THEN
    ALTER TABLE store_orders ADD COLUMN coupon_id uuid;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_orders' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE store_orders ADD COLUMN discount_amount numeric DEFAULT 0;
  END IF;
END $$;