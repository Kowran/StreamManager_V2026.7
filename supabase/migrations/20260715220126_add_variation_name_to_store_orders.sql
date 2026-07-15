-- Add variation_name column to store_orders for display purposes
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS variation_name TEXT;
