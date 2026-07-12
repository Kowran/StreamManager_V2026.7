/*
# Add level system for users and sellers

## Purpose
Create a leveling system from 1 to 1000 for both users (based on purchases) and
sellers (based on sales). The higher the level, the harder it becomes to advance.
This migration adds XP columns to profiles and database functions to calculate
and update levels.

## Changes
1. New columns on `profiles`:
   - `user_xp` (integer, default 0) — experience points from purchases
   - `seller_xp` (integer, default 0) — experience points from sales
   - `user_level` (integer, default 1) — current user level (1-1000)
   - `seller_level` (integer, default 1) — current seller level (1-1000)

2. New functions:
   - `xp_for_level(level int)` — returns total XP needed to reach a given level.
     Uses an exponential curve: xp = floor(100 * level^1.8). This makes level 1
     require 100 XP, level 100 require ~630K XP, and level 1000 require ~50M XP.
   - `level_from_xp(xp int)` — returns the level for a given XP amount (1-1000).
   - `update_user_level(user_uuid)` — recalculates user_xp from completed purchases,
     derives user_level, and updates the profile.
   - `update_seller_level(seller_uuid)` — recalculates seller_xp from completed sales,
     derives seller_level, and updates the profile.

3. Security:
   - All functions are SECURITY DEFINER so they can read store_orders and update
     profiles regardless of the caller's RLS.
   - No new RLS policies needed — existing profiles SELECT/UPDATE policies apply.

## Notes
- XP for users: 10 XP per dollar spent on completed purchases.
- XP for sellers: 15 XP per dollar earned from completed sales.
- Level cap is 1000 — level_from_xp clamps at 1000.
- Functions are idempotent and safe to call repeatedly.
*/

-- Add XP and level columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'user_xp'
  ) THEN
    ALTER TABLE profiles ADD COLUMN user_xp integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'seller_xp'
  ) THEN
    ALTER TABLE profiles ADD COLUMN seller_xp integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'user_level'
  ) THEN
    ALTER TABLE profiles ADD COLUMN user_level integer NOT NULL DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'seller_level'
  ) THEN
    ALTER TABLE profiles ADD COLUMN seller_level integer NOT NULL DEFAULT 1;
  END IF;
END $$;

-- Function: XP required to reach a given level (exponential curve)
CREATE OR REPLACE FUNCTION xp_for_level(target_level int)
RETURNS bigint AS $$
BEGIN
  IF target_level <= 1 THEN
    RETURN 0;
  END IF;
  RETURN floor(100 * power(target_level - 1, 1.8))::bigint;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Derive level from XP (clamped 1-1000)
CREATE OR REPLACE FUNCTION level_from_xp(xp_amount bigint)
RETURNS int AS $$
DECLARE
  lvl int;
BEGIN
  IF xp_amount <= 0 THEN
    RETURN 1;
  END IF;

  -- Binary search for the level
  lvl := 1;
  WHILE lvl < 1000 AND xp_for_level(lvl + 1) <= xp_amount LOOP
    lvl := lvl + 1;
  END LOOP;

  RETURN LEAST(lvl, 1000);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Update user XP and level from completed purchases
CREATE OR REPLACE FUNCTION update_user_level(target_user uuid)
RETURNS void AS $$
DECLARE
  total_xp bigint := 0;
  new_level int := 1;
BEGIN
  -- Sum XP from completed/delivered purchases: 10 XP per dollar
  SELECT COALESCE(SUM(total_usdt * 10), 0)::bigint
  INTO total_xp
  FROM store_orders
  WHERE user_id = target_user
    AND status IN ('completed', 'delivered');

  new_level := level_from_xp(total_xp);

  UPDATE profiles
  SET user_xp = total_xp,
      user_level = new_level,
      updated_at = now()
  WHERE id = target_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update seller XP and level from completed sales
CREATE OR REPLACE FUNCTION update_seller_level(target_seller uuid)
RETURNS void AS $$
DECLARE
  total_xp bigint := 0;
  new_level int := 1;
BEGIN
  -- Sum XP from completed/delivered sales: 15 XP per dollar
  SELECT COALESCE(SUM(total_usdt * 15), 0)::bigint
  INTO total_xp
  FROM store_orders
  WHERE seller_id = target_seller
    AND status IN ('completed', 'delivered');

  new_level := level_from_xp(total_xp);

  UPDATE profiles
  SET seller_xp = total_xp,
      seller_level = new_level,
      updated_at = now()
  WHERE id = target_seller;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill levels for existing users and sellers
UPDATE profiles p
SET user_xp = COALESCE((
    SELECT (SUM(so.total_usdt) * 10)::bigint
    FROM store_orders so
    WHERE so.user_id = p.id AND so.status IN ('completed', 'delivered')
  ), 0),
    user_level = level_from_xp(COALESCE((
    SELECT (SUM(so.total_usdt) * 10)::bigint
    FROM store_orders so
    WHERE so.user_id = p.id AND so.status IN ('completed', 'delivered')
  ), 0)),
    seller_xp = COALESCE((
    SELECT (SUM(so.total_usdt) * 15)::bigint
    FROM store_orders so
    WHERE so.seller_id = p.id AND so.status IN ('completed', 'delivered')
  ), 0),
    seller_level = level_from_xp(COALESCE((
    SELECT (SUM(so.total_usdt) * 15)::bigint
    FROM store_orders so
    WHERE so.seller_id = p.id AND so.status IN ('completed', 'delivered')
  ), 0));
