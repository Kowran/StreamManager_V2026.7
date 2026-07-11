/*
  # Add Product Features System

  1. Schema Changes
    - Add `features` JSONB column to `store_products` table to store product characteristics
    - Features will be displayed as green badges in the store

  2. Security
    - Only admins can edit product features
    - All users can view features of active products
*/

-- Add features column to store_products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_products' AND column_name = 'features'
  ) THEN
    ALTER TABLE store_products ADD COLUMN features JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add comment to the features column
COMMENT ON COLUMN store_products.features IS 'Array of product features/characteristics to display as badges in the store';

-- Create index for features column for better performance
CREATE INDEX IF NOT EXISTS idx_store_products_features ON store_products USING gin (features);