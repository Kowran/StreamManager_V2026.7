/*
  # Remove Binance Configuration

  1. Changes
    - Drop `binance_config` table completely
    - Remove all Binance-related configurations from the database

  2. Notes
    - This migration removes all Binance Pay integration from the system
    - Any existing Binance configuration data will be permanently deleted
*/

DROP TABLE IF EXISTS binance_config CASCADE;