/*
  # Remove Complete Credits Recharge System

  This migration removes all components of the credits recharge system:

  1. Tables Removed
    - `credit_recharge_methods` - Payment method configurations
    - `credit_recharges` - Recharge transactions and payment data
    - `balance_transactions` - Legacy transaction records
    - `credit_transactions` - Credit transaction history
    - `user_credits` - User credit balances

  2. Functions Removed
    - All credit-related trigger functions
    - Payment processing functions
    - Credit calculation functions

  3. Security
    - Remove all RLS policies for credit tables
    - Clean up any orphaned references

  4. Data Cleanup
    - All credit data will be permanently deleted
    - Payment history will be removed
    - User balances will be reset
*/

-- Drop all credit-related tables in correct order (respecting foreign keys)

-- Drop credit_recharges first (has foreign key to credit_recharge_methods)
DROP TABLE IF EXISTS credit_recharges CASCADE;

-- Drop credit_recharge_methods
DROP TABLE IF EXISTS credit_recharge_methods CASCADE;

-- Drop balance_transactions
DROP TABLE IF EXISTS balance_transactions CASCADE;

-- Drop credit_transactions (has foreign key to user_credits)
DROP TABLE IF EXISTS credit_transactions CASCADE;

-- Drop user_credits last
DROP TABLE IF EXISTS user_credits CASCADE;

-- Drop any credit-related functions
DROP FUNCTION IF EXISTS process_completed_recharge() CASCADE;
DROP FUNCTION IF EXISTS process_completed_mercadopago_recharge() CASCADE;
DROP FUNCTION IF EXISTS update_user_credit_totals() CASCADE;
DROP FUNCTION IF EXISTS validate_credit_transaction() CASCADE;
DROP FUNCTION IF EXISTS create_user_credits() CASCADE;

-- Clean up any system config related to credits
DELETE FROM system_config WHERE key IN (
  'credit_system_config',
  'recharge_methods_config',
  'payment_limits_config'
);

-- Remove any notifications related to credits
DELETE FROM notifications WHERE type IN (
  'credit_low',
  'payment'
);

-- Clean up any admin actions related to credits
DELETE FROM admin_actions WHERE action LIKE '%credit%' OR action LIKE '%recharge%';