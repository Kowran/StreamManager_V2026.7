/*
  # Remove Binance API System

  1. Tables to Drop
    - `binance_payments` - All Binance payment records
  
  2. Configuration Cleanup
    - Remove Binance Pay configuration from system_config
    - Remove Binance Personal configuration from system_config
  
  3. Security
    - Clean removal of all Binance-related data and configurations
*/

-- Remove Binance payment configurations from system_config
DELETE FROM system_config WHERE key IN ('binance_pay_config', 'binance_personal_config');

-- Drop binance_payments table if it exists
DROP TABLE IF EXISTS binance_payments CASCADE;

-- Clean up any remaining references in other tables
UPDATE system_config 
SET value = jsonb_set(
  COALESCE(value, '{}'),
  '{payment_methods}',
  (COALESCE(value->'payment_methods', '[]'::jsonb) - 'binance_pay' - 'binance_personal')
)
WHERE key = 'store_config' AND value ? 'payment_methods';

-- Remove any Binance-related admin actions
DELETE FROM admin_actions WHERE action LIKE '%binance%';

-- Remove any Binance-related activity logs
DELETE FROM user_activity_logs WHERE action LIKE '%binance%' OR details::text LIKE '%binance%';