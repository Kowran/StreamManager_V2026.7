/*
# Seller Level Benefits System

## Purpose
Create a tiered benefits system where sellers pay lower platform fees as they
level up through sales. The existing commission system uses a flat rate from
`sales_commission_config`; this migration introduces level-based commission
rates that override the flat default when a seller has reached a qualifying level.

## Changes

1. New Table: `seller_level_benefits`
   - `id` (uuid, primary key)
   - `min_level` (integer) — minimum seller level to qualify for this tier
   - `tier_name` (text) — display name (e.g. "Iniciante", "Bronze", "Prata", etc.)
   - `admin_commission_rate` (numeric) — platform fee % for sellers at this level
   - `seller_commission_rate` (numeric) — seller's share % (100 - admin rate)
   - `icon` (text) — optional icon name for UI display
   - `color` (text) — optional hex color for UI badges
   - `sort_order` (integer) — display order
   - `is_active` (boolean, default true)
   - `created_at`, `updated_at` (timestamps)

2. Seed Data: 6 default tiers
   - Level 1: "Iniciante" — 5% platform fee
   - Level 10: "Bronze" — 4% platform fee
   - Level 30: "Prata" — 3% platform fee
   - Level 60: "Ouro" — 2% platform fee
   - Level 100: "Platina" — 1.5% platform fee
   - Level 200: "Diamante" — 1% platform fee

3. New Function: `get_seller_commission_rate(p_seller_id uuid)`
   - Returns the lowest applicable admin_commission_rate for the seller's level.
   - Falls back to the global `sales_commission_config` default if no tier matches.

4. Modified Trigger: `calculate_sales_commission()`
   - Updated to use `get_seller_commission_rate()` instead of the flat config rate.
   - The seller_commission_rate is derived as `100 - admin_commission_rate`.

5. New Function: `get_seller_level_info(p_seller_id uuid)`
   - Returns the seller's current level, tier name, admin rate, seller rate,
     XP, XP needed for next level, and next tier info.
   - Used by the frontend to display level benefits to sellers.

6. Security
   - RLS enabled on `seller_level_benefits`.
   - Anyone authenticated can SELECT (benefits are public information).
   - Only admins can INSERT/UPDATE/DELETE.
*/

-- Create seller_level_benefits table
CREATE TABLE IF NOT EXISTS seller_level_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_level integer NOT NULL DEFAULT 1,
  tier_name text NOT NULL,
  admin_commission_rate numeric NOT NULL DEFAULT 5.00,
  seller_commission_rate numeric NOT NULL DEFAULT 95.00,
  icon text,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_level_benefit_rates CHECK (
    admin_commission_rate >= 0 AND
    admin_commission_rate <= 100 AND
    seller_commission_rate >= 0 AND
    seller_commission_rate <= 100
  )
);

-- Enable RLS
ALTER TABLE seller_level_benefits ENABLE ROW LEVEL SECURITY;

-- Policies: anyone authenticated can read, only admins can modify
DROP POLICY IF EXISTS "Anyone can view seller level benefits" ON seller_level_benefits;
CREATE POLICY "Anyone can view seller level benefits"
  ON seller_level_benefits FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert seller level benefits" ON seller_level_benefits;
CREATE POLICY "Admins can insert seller level benefits"
  ON seller_level_benefits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update seller level benefits" ON seller_level_benefits;
CREATE POLICY "Admins can update seller level benefits"
  ON seller_level_benefits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can delete seller level benefits" ON seller_level_benefits;
CREATE POLICY "Admins can delete seller level benefits"
  ON seller_level_benefits FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seed default tiers
INSERT INTO seller_level_benefits (min_level, tier_name, admin_commission_rate, seller_commission_rate, icon, color, sort_order, is_active)
VALUES
  (1,   'Iniciante', 5.00, 95.00, 'Sprout',   '#10b981', 1,  true),
  (10,  'Bronze',    4.00, 96.00, 'Award',    '#cd7f32', 2,  true),
  (30,  'Prata',     3.00, 97.00, 'Medal',    '#94a3b8', 3,  true),
  (60,  'Ouro',      2.00, 98.00, 'Crown',    '#f59e0b', 4,  true),
  (100, 'Platina',   1.50, 98.50, 'Gem',      '#06b6d4', 5,  true),
  (200, 'Diamante',  1.00, 99.00, 'Diamond',  '#3b82f6', 6,  true)
ON CONFLICT DO NOTHING;

-- Function: get the applicable commission rate for a seller based on their level
CREATE OR REPLACE FUNCTION get_seller_commission_rate(p_seller_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level integer := 1;
  v_rate numeric;
BEGIN
  SELECT seller_level INTO v_level
  FROM profiles
  WHERE id = p_seller_id;

  -- Find the best (lowest admin rate) tier where min_level <= seller's level
  SELECT admin_commission_rate INTO v_rate
  FROM seller_level_benefits
  WHERE is_active = true AND min_level <= COALESCE(v_level, 1)
  ORDER BY min_level DESC
  LIMIT 1;

  -- Fall back to global config if no tier found
  IF v_rate IS NULL THEN
    SELECT admin_commission_rate INTO v_rate FROM sales_commission_config LIMIT 1;
  END IF;

  RETURN COALESCE(v_rate, 4.00);
END;
$$;

-- Function: get full level info for a seller (for frontend display)
CREATE OR REPLACE FUNCTION get_seller_level_info(p_seller_id uuid)
RETURNS TABLE (
  seller_level integer,
  seller_xp bigint,
  current_tier_name text,
  current_tier_color text,
  current_tier_icon text,
  admin_rate numeric,
  seller_rate numeric,
  next_tier_name text,
  next_tier_min_level integer,
  next_tier_admin_rate numeric,
  xp_to_next_tier bigint,
  progress_pct numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level integer := 1;
  v_xp bigint := 0;
  v_current_tier RECORD;
  v_next_tier RECORD;
  v_xp_for_current bigint;
  v_xp_for_next_tier bigint;
BEGIN
  SELECT seller_level, seller_xp INTO v_level, v_xp
  FROM profiles WHERE id = p_seller_id;

  v_level := COALESCE(v_level, 1);
  v_xp := COALESCE(v_xp, 0);

  -- Current tier
  SELECT * INTO v_current_tier
  FROM seller_level_benefits
  WHERE is_active = true AND min_level <= v_level
  ORDER BY min_level DESC
  LIMIT 1;

  -- Next tier
  SELECT * INTO v_next_tier
  FROM seller_level_benefits
  WHERE is_active = true AND min_level > v_level
  ORDER BY min_level ASC
  LIMIT 1;

  v_xp_for_current := xp_for_level(v_level);
  v_xp_for_next_tier := xp_for_level(v_next_tier.min_level);

  RETURN QUERY SELECT
    v_level,
    v_xp,
    v_current_tier.tier_name,
    v_current_tier.color,
    v_current_tier.icon,
    v_current_tier.admin_commission_rate,
    v_current_tier.seller_commission_rate,
    v_next_tier.tier_name,
    v_next_tier.min_level,
    v_next_tier.admin_commission_rate,
    CASE
      WHEN v_next_tier.min_level IS NULL THEN 0
      ELSE GREATEST(0, xp_for_level(v_next_tier.min_level) - v_xp)
    END,
    CASE
      WHEN v_next_tier.min_level IS NULL THEN 100
      WHEN v_xp_for_next_tier = v_xp_for_current THEN 100
      ELSE LEAST(100, ROUND(((v_xp - v_xp_for_current)::numeric / (v_xp_for_next_tier - v_xp_for_current)::numeric * 100)::numeric, 1))
    END;
END;
$$;

-- Update the commission trigger to use level-based rates
CREATE OR REPLACE FUNCTION calculate_sales_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
  v_seller_id uuid;
  v_admin_rate numeric;
  v_seller_rate numeric;
  v_admin_amount_brl numeric;
  v_seller_amount_brl numeric;
  v_admin_amount_usdt numeric;
  v_seller_amount_usdt numeric;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    SELECT seller_id INTO v_seller_id
    FROM store_products
    WHERE id = NEW.product_id;

    IF v_seller_id IS NOT NULL THEN
      -- Get level-based rate for this seller
      v_admin_rate := get_seller_commission_rate(v_seller_id);
      v_seller_rate := 100.0 - v_admin_rate;

      IF NEW.total_brl IS NOT NULL AND NEW.total_brl > 0 THEN
        v_admin_amount_brl := ROUND((NEW.total_brl * v_admin_rate / 100)::numeric, 2);
        v_seller_amount_brl := ROUND((NEW.total_brl * v_seller_rate / 100)::numeric, 2);

        INSERT INTO sales_commissions (
          order_id, seller_id, total_amount,
          admin_commission_rate, seller_commission_rate,
          admin_amount, seller_amount, currency, status
        ) VALUES (
          NEW.id, v_seller_id, NEW.total_brl,
          v_admin_rate, v_seller_rate,
          v_admin_amount_brl, v_seller_amount_brl, 'BRL', 'pending'
        )
        ON CONFLICT (order_id, currency) DO NOTHING;
      END IF;

      IF NEW.total_usdt IS NOT NULL AND NEW.total_usdt > 0 THEN
        v_admin_amount_usdt := ROUND((NEW.total_usdt * v_admin_rate / 100)::numeric, 2);
        v_seller_amount_usdt := ROUND((NEW.total_usdt * v_seller_rate / 100)::numeric, 2);

        INSERT INTO sales_commissions (
          order_id, seller_id, total_amount,
          admin_commission_rate, seller_commission_rate,
          admin_amount, seller_amount, currency, status
        ) VALUES (
          NEW.id, v_seller_id, NEW.total_usdt,
          v_admin_rate, v_seller_rate,
          v_admin_amount_usdt, v_seller_amount_usdt, 'USDT', 'pending'
        )
        ON CONFLICT (order_id, currency) DO NOTHING;
      END IF;

      -- Update seller level after completed sale
      PERFORM update_seller_level(v_seller_id);
    END IF;
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE sales_commissions
    SET status = 'cancelled', updated_at = now()
    WHERE order_id = NEW.id AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_seller_level_benefits_min_level ON seller_level_benefits(min_level);
