/*
# Fix trigger to preserve full delivery_content in user_purchases.credentials

## Problem
The trigger `create_user_purchase_from_delivery` was manually building a jsonb object
with only `email`, `password`, and `instructions` fields, dropping the `accounts` array
that is present in `store_deliveries.delivery_content` for multi-unit purchases.
This caused users to see empty credentials when buying more than 1 unit.

## Changes
1. Replaces the trigger function to copy the FULL `delivery_content` JSONB as `credentials`,
   preserving the `accounts` array and all other fields.
2. Backfills existing `user_purchases` rows by copying the complete `delivery_content`
   from their corresponding `store_deliveries` records.

## Security
- No RLS policy changes.
- Function remains SECURITY DEFINER with search_path = ''.
*/

CREATE OR REPLACE FUNCTION create_user_purchase_from_delivery()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_purchases (
    user_id,
    order_id,
    product_id,
    product_name,
    purchase_price,
    credentials,
    purchase_date
  ) VALUES (
    NEW.user_id,
    NEW.order_id,
    NEW.product_id,
    (NEW.delivery_content->>'product_name')::text,
    COALESCE(
      (SELECT total_usdt FROM store_orders WHERE id = NEW.order_id),
      0
    ),
    NEW.delivery_content,
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Backfill existing user_purchases with full delivery_content from store_deliveries
UPDATE user_purchases up
SET credentials = sd.delivery_content
FROM store_deliveries sd
WHERE sd.order_id = up.order_id
  AND sd.product_id = up.product_id
  AND up.credentials ? 'accounts' = false
  AND sd.delivery_content ? 'accounts';
