/*
  # Fix Ratings System + Cover Photo Zoom + Allow Re-rating

  ## Problems Fixed
  1. User ratings not loading on profile - FK references auth.users not profiles, so join fails
  2. Product ratings UNIQUE(user_id, product_id) prevents re-rating after new purchase
  3. store_orders has no has_rated column but frontend queries it
  4. can_user_rate_product checks user_purchases but should check store_orders

  ## Changes
  1. Drop UNIQUE(user_id, product_id) from product_ratings - allow multiple ratings per product
  2. Add order_id to product_ratings to link rating to specific purchase
  3. Add has_rated column to store_orders to track if order was rated
  4. Update can_user_rate_product to check store_orders instead of user_purchases
  5. Add cover_url zoom/position columns to profiles
  6. Create get_seller_level_info function for dashboard banner
  7. Fix product_rating_summary view
*/

-- ============================================================
-- 1. Remove UNIQUE constraint from product_ratings to allow re-rating
-- ============================================================
ALTER TABLE product_ratings DROP CONSTRAINT IF EXISTS product_ratings_user_id_product_id_key;

-- Add order_id to link rating to specific purchase
ALTER TABLE product_ratings ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES store_orders(id) ON DELETE SET NULL;
ALTER TABLE product_ratings ADD COLUMN IF NOT EXISTS rated_at timestamptz DEFAULT now();

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_ratings_product_id ON product_ratings(product_id);
CREATE INDEX IF NOT EXISTS idx_product_ratings_user_id ON product_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_product_ratings_order_id ON product_ratings(order_id);

-- ============================================================
-- 2. Add has_rated column to store_orders
-- ============================================================
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS has_rated boolean NOT NULL DEFAULT false;

-- ============================================================
-- 3. Update can_user_rate_product to check store_orders
-- ============================================================
CREATE OR REPLACE FUNCTION can_user_rate_product(p_user_id uuid, p_product_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM store_orders
    WHERE user_id = p_user_id
      AND product_id = p_product_id
      AND status IN ('completed', 'delivered')
  );
END;
$$;

-- ============================================================
-- 4. Add cover photo zoom/position columns to profiles
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_zoom numeric DEFAULT 1.0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_position_x numeric DEFAULT 50.0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_position_y numeric DEFAULT 50.0;

-- ============================================================
-- 5. Create get_seller_level_info function for dashboard
-- ============================================================
DROP FUNCTION IF EXISTS get_seller_level_info(uuid);

CREATE FUNCTION get_seller_level_info(p_seller_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level integer := 1;
  v_xp bigint := 0;
  v_current_tier text;
  v_current_color text;
  v_current_admin_rate numeric;
  v_current_seller_rate numeric;
  v_next_tier text;
  v_next_color text;
  v_next_min_level integer;
  v_next_admin_rate numeric;
  v_xp_current bigint;
  v_xp_next bigint;
  v_progress numeric;
  v_xp_to_next bigint;
BEGIN
  SELECT seller_level, seller_xp INTO v_level, v_xp
  FROM profiles WHERE id = p_seller_id;

  SELECT tier_name, color, admin_commission_rate, seller_commission_rate
  INTO v_current_tier, v_current_color, v_current_admin_rate, v_current_seller_rate
  FROM seller_level_benefits
  WHERE is_active = true AND min_level <= COALESCE(v_level, 1)
  ORDER BY min_level DESC LIMIT 1;

  SELECT tier_name, color, min_level, admin_commission_rate
  INTO v_next_tier, v_next_color, v_next_min_level, v_next_admin_rate
  FROM seller_level_benefits
  WHERE is_active = true AND min_level > COALESCE(v_level, 1)
  ORDER BY min_level ASC LIMIT 1;

  v_xp_current := xp_for_level(COALESCE(v_level, 1));
  v_xp_next := xp_for_level(COALESCE(v_level, 1) + 1);

  IF v_next_tier IS NOT NULL THEN
    v_progress := LEAST(100, ROUND((COALESCE(v_xp, 0) - v_xp_current)::numeric / GREATEST(1, (v_xp_next - v_xp_current)) * 100, 1));
    v_xp_to_next := GREATEST(0, v_xp_next - COALESCE(v_xp, 0));
  ELSE
    v_progress := 100;
    v_xp_to_next := 0;
  END IF;

  RETURN json_build_object(
    'seller_level', COALESCE(v_level, 1),
    'seller_xp', COALESCE(v_xp, 0),
    'current_tier_name', COALESCE(v_current_tier, 'Iniciante'),
    'current_tier_color', COALESCE(v_current_color, '#10b981'),
    'admin_rate', COALESCE(v_current_admin_rate, 5.00),
    'seller_rate', COALESCE(v_current_seller_rate, 95.00),
    'next_tier_name', v_next_tier,
    'next_tier_color', v_next_color,
    'next_tier_min_level', v_next_min_level,
    'next_admin_rate', v_next_admin_rate,
    'progress_pct', v_progress,
    'xp_to_next_tier', v_xp_to_next
  );
END;
$$;

-- ============================================================
-- 6. Update product_rating_summary view
-- ============================================================
CREATE OR REPLACE VIEW product_rating_summary AS
SELECT
  sp.id,
  sp.name,
  sp.category,
  sp.price_usdt,
  sp.active,
  COALESCE(avg(pr.rating::numeric), 0::numeric) AS average_rating,
  count(pr.id) AS total_ratings,
  count(pr.id) FILTER (WHERE pr.rating = 5) AS five_star_count,
  count(pr.id) FILTER (WHERE pr.rating = 4) AS four_star_count,
  count(pr.id) FILTER (WHERE pr.rating = 3) AS three_star_count,
  count(pr.id) FILTER (WHERE pr.rating = 2) AS two_star_count,
  count(pr.id) FILTER (WHERE pr.rating = 1) AS one_star_count
FROM store_products sp
LEFT JOIN product_ratings pr ON sp.id = pr.product_id
GROUP BY sp.id, sp.name, sp.category, sp.price_usdt, sp.active;

-- ============================================================
-- 7. Backfill has_rated for existing completed orders that have ratings
-- ============================================================
UPDATE store_orders so
SET has_rated = true
WHERE so.status IN ('completed', 'delivered')
  AND EXISTS (
    SELECT 1 FROM product_ratings pr
    WHERE pr.user_id = so.user_id AND pr.product_id = so.product_id
  );
