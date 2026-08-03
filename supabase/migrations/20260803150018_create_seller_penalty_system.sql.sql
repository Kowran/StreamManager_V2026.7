/*
# Seller Store Penalty System

## Overview
Creates a 3-strike penalty system for seller stores. Admins can apply penalties
at 3 levels and revert them. Each level has escalating consequences:
- Level 1 (Warning): Just a warning, seller sees it in reputation panel
- Level 2 (Suspension): Products auto-hidden, sales suspended, store_suspended=true
- Level 3 (Permanent): Store permanently suspended, balance frozen, no withdrawals

## New Tables
- `seller_penalties`: Records each penalty applied to a seller
  - id, seller_id, penalty_level (1-3), reason, applied_by, applied_at,
    reverted_by, reverted_at, revert_reason, is_active

## Modified Tables
- `profiles`: Adds penalty_count (int default 0) and store_permanently_suspended (boolean default false)

## Security
- RLS enabled on seller_penalties
- Sellers can read their own penalties (SELECT only)
- Edge function with service role manages insert/update via SECURITY DEFINER functions
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS penalty_count integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS store_permanently_suspended boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS seller_penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  penalty_level integer NOT NULL CHECK (penalty_level IN (1, 2, 3)),
  reason text,
  applied_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  reverted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reverted_at timestamptz,
  revert_reason text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_penalties_seller_id ON seller_penalties(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_penalties_active ON seller_penalties(seller_id) WHERE is_active = true;

ALTER TABLE seller_penalties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_penalties" ON seller_penalties;
CREATE POLICY "select_own_penalties" ON seller_penalties FOR SELECT
  TO authenticated USING (auth.uid() = seller_id);

-- Apply a penalty at a given level
CREATE OR REPLACE FUNCTION apply_seller_penalty(
  p_seller_id uuid,
  p_penalty_level integer,
  p_reason text DEFAULT NULL,
  p_applied_by uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO seller_penalties (seller_id, penalty_level, reason, applied_by)
  VALUES (p_seller_id, p_penalty_level, p_reason, p_applied_by);

  IF p_penalty_level = 1 THEN
    UPDATE profiles SET
      penalty_count = penalty_count + 1,
      store_suspended = false,
      store_permanently_suspended = false,
      updated_at = now()
    WHERE id = p_seller_id;

  ELSIF p_penalty_level = 2 THEN
    UPDATE profiles SET
      penalty_count = penalty_count + 1,
      store_suspended = true,
      store_permanently_suspended = false,
      updated_at = now()
    WHERE id = p_seller_id;

    UPDATE store_products SET active = false WHERE seller_id = p_seller_id;

  ELSIF p_penalty_level = 3 THEN
    UPDATE profiles SET
      penalty_count = penalty_count + 1,
      store_suspended = true,
      store_permanently_suspended = true,
      balance_frozen = true,
      balance_frozen_at = now(),
      balance_frozen_by = p_applied_by,
      balance_frozen_reason = COALESCE(p_reason, 'Permanent store suspension - Level 3 penalty'),
      updated_at = now()
    WHERE id = p_seller_id;

    UPDATE store_products SET active = false WHERE seller_id = p_seller_id;
    UPDATE user_credits SET frozen = true, updated_at = now() WHERE user_id = p_seller_id;
  END IF;
END;
$$;

-- Revert the most recent active penalty
CREATE OR REPLACE FUNCTION revert_seller_penalty(
  p_seller_id uuid,
  p_reverted_by uuid DEFAULT NULL,
  p_revert_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_level integer;
  v_penalty_id uuid;
BEGIN
  SELECT id, penalty_level INTO v_penalty_id, v_current_level
  FROM seller_penalties
  WHERE seller_id = p_seller_id AND is_active = true
  ORDER BY applied_at DESC
  LIMIT 1;

  IF v_penalty_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE seller_penalties SET
    is_active = false,
    reverted_by = p_reverted_by,
    reverted_at = now(),
    revert_reason = p_revert_reason
  WHERE id = v_penalty_id;

  UPDATE profiles SET
    penalty_count = GREATEST(0, penalty_count - 1),
    updated_at = now()
  WHERE id = p_seller_id;

  IF v_current_level = 3 THEN
    UPDATE profiles SET
      store_permanently_suspended = false,
      balance_frozen = false,
      balance_frozen_at = NULL,
      balance_frozen_by = NULL,
      balance_frozen_reason = NULL,
      updated_at = now()
    WHERE id = p_seller_id;

    UPDATE user_credits SET frozen = false, updated_at = now() WHERE user_id = p_seller_id;

    IF EXISTS (
      SELECT 1 FROM seller_penalties
      WHERE seller_id = p_seller_id AND is_active = true AND penalty_level = 2
    ) THEN
      UPDATE profiles SET store_suspended = true WHERE id = p_seller_id;
    ELSE
      UPDATE profiles SET store_suspended = false WHERE id = p_seller_id;
      UPDATE store_products SET active = true WHERE seller_id = p_seller_id;
    END IF;

  ELSIF v_current_level = 2 THEN
    UPDATE profiles SET store_suspended = false WHERE id = p_seller_id;
    UPDATE store_products SET active = true WHERE seller_id = p_seller_id;
  ELSIF v_current_level = 1 THEN
    NULL;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION apply_seller_penalty(uuid, integer, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION revert_seller_penalty(uuid, uuid, text) FROM PUBLIC;
GRANT SELECT ON seller_penalties TO authenticated;
