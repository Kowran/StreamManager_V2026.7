-- Add status column to payment_methods_config for 3-state control: active, hidden, inactive
-- active: visible and usable by users
-- hidden: not shown to users (but configured)
-- inactive: shown but disabled (greyed out, not clickable)

ALTER TABLE payment_methods_config
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add check constraint for valid statuses
ALTER TABLE payment_methods_config
  DROP CONSTRAINT IF EXISTS payment_methods_config_status_check;
ALTER TABLE payment_methods_config
  ADD CONSTRAINT payment_methods_config_status_check
  CHECK (status IN ('active', 'hidden', 'inactive'));

-- Migrate existing is_active values to status
UPDATE payment_methods_config
  SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END
  WHERE status = 'active' AND is_active = false;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_payment_methods_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payment_methods_config_updated_at ON payment_methods_config;
CREATE TRIGGER trigger_update_payment_methods_config_updated_at
  BEFORE UPDATE ON payment_methods_config
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_methods_config_updated_at();
