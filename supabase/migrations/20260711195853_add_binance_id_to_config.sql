/*
# Add binance_id column to binance_config

1. Changes
- Adds `binance_id` (text) column to `binance_config` table — stores the Binance Pay ID for manual deposits/transfers.
- Sets default value to '1145829605' so the current Binance ID is immediately available.

2. Notes
- No RLS changes needed; existing policies cover the new column automatically.
*/

ALTER TABLE binance_config
  ADD COLUMN IF NOT EXISTS binance_id text NOT NULL DEFAULT '1145829605';
