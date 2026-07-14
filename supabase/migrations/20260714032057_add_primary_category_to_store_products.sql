/*
# Add primary_category to store_products

1. Purpose
   Adds a new `primary_category` column to `store_products` to classify products
   into high-level categories: account, item, mobile_recharge, game, gift_card, top_up.
   This column is used as a filter on the store and landing page.

2. Changes
   - Added column `primary_category` (text, NOT NULL, default 'item') to `store_products`.
   - Added index on `primary_category` for faster filtering.

3. Security
   - No RLS policy changes. Existing policies on `store_products` remain unchanged.

4. Notes
   - The default value 'item' ensures all existing products get a sensible primary category.
   - The existing `category` column remains for sub-categorization (streaming, music, etc).
   - Valid values: 'account', 'item', 'mobile_recharge', 'game', 'gift_card', 'top_up'.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_products' AND column_name = 'primary_category'
  ) THEN
    ALTER TABLE store_products ADD COLUMN primary_category text NOT NULL DEFAULT 'item';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_store_products_primary_category ON store_products(primary_category);
