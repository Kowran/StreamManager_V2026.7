/*
  # Add renewable field to store products

  1. Schema Changes
    - Add `renewable` boolean field to `store_products` table
    - Set default value to false for existing products
    - Add index for renewable field for better query performance

  2. Data Migration
    - All existing products will have renewable = false by default
    - Admins can update this field through the admin interface

  3. Security
    - Only admins can modify the renewable field
    - Regular users can view this information in the store
*/

-- Add renewable field to store_products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_products' AND column_name = 'renewable'
  ) THEN
    ALTER TABLE store_products ADD COLUMN renewable boolean DEFAULT false;
  END IF;
END $$;

-- Add index for renewable field
CREATE INDEX IF NOT EXISTS idx_store_products_renewable 
ON store_products (renewable) 
WHERE renewable = true;

-- Update existing products to have renewable = false (already default)
UPDATE store_products 
SET renewable = false 
WHERE renewable IS NULL;

-- Add comment to the column
COMMENT ON COLUMN store_products.renewable IS 'Indicates if the product can be renewed after expiration';