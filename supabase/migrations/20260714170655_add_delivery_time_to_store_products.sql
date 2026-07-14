/*
# Add delivery_time column to store_products

1. Changes
- Adds `delivery_time` (text, nullable) to `store_products` table.
- This field allows sellers to specify estimated delivery time for manual delivery, top-up, and recharge products.
- Examples: "Até 24h", "1-3 dias úteis", "Imediato após confirmação", etc.

2. Notes
- No RLS changes needed — the column is accessible under existing policies.
- The column is optional (nullable) so existing products are unaffected.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_products' AND column_name = 'delivery_time'
  ) THEN
    ALTER TABLE store_products ADD COLUMN delivery_time text;
  END IF;
END $$;
