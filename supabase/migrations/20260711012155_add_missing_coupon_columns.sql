-- Add columns the frontend expects to discount_coupons table
-- The table was created with different column names than the frontend uses

-- Add expires_at (alias for valid_until)
ALTER TABLE discount_coupons ADD COLUMN IF NOT EXISTS expires_at timestamptz;
UPDATE discount_coupons SET expires_at = valid_until WHERE expires_at IS NULL AND valid_until IS NOT NULL;

-- Add starts_at (alias for valid_from)  
ALTER TABLE discount_coupons ADD COLUMN IF NOT EXISTS starts_at timestamptz;
UPDATE discount_coupons SET starts_at = valid_from WHERE starts_at IS NULL;

-- Add min_order_amount (alias for min_purchase_amount)
ALTER TABLE discount_coupons ADD COLUMN IF NOT EXISTS min_order_amount numeric DEFAULT 0;
UPDATE discount_coupons SET min_order_amount = min_purchase_amount WHERE min_order_amount IS NULL;

-- Add max_uses (alias for usage_limit)
ALTER TABLE discount_coupons ADD COLUMN IF NOT EXISTS max_uses integer;
UPDATE discount_coupons SET max_uses = usage_limit WHERE max_uses IS NULL;

-- Add used_count (alias for usage_count)
ALTER TABLE discount_coupons ADD COLUMN IF NOT EXISTS used_count integer DEFAULT 0;
UPDATE discount_coupons SET used_count = usage_count WHERE used_count IS NULL;

-- Add max_uses_per_user (alias for user_usage_limit)
ALTER TABLE discount_coupons ADD COLUMN IF NOT EXISTS max_uses_per_user integer DEFAULT 1;
UPDATE discount_coupons SET max_uses_per_user = user_usage_limit WHERE max_uses_per_user IS NULL;

-- Keep triggers in sync: update alias columns when original columns change
CREATE OR REPLACE FUNCTION sync_coupon_alias_columns()
RETURNS trigger AS $$
BEGIN
  -- Sync alias columns from original columns
  NEW.expires_at := COALESCE(NEW.expires_at, NEW.valid_until);
  NEW.starts_at := COALESCE(NEW.starts_at, NEW.valid_from);
  NEW.min_order_amount := COALESCE(NEW.min_order_amount, NEW.min_purchase_amount);
  NEW.max_uses := COALESCE(NEW.max_uses, NEW.usage_limit);
  NEW.used_count := COALESCE(NEW.used_count, NEW.usage_count);
  NEW.max_uses_per_user := COALESCE(NEW.max_uses_per_user, NEW.user_usage_limit);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_coupon_aliases ON discount_coupons;
CREATE TRIGGER trigger_sync_coupon_aliases
  BEFORE INSERT OR UPDATE ON discount_coupons
  FOR EACH ROW EXECUTE FUNCTION sync_coupon_alias_columns();
