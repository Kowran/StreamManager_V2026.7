/*
# Add cashback_used column to store_orders

1. Modified Tables
- `store_orders` — adds `cashback_used` numeric column (default 0) to track how much cashback was applied to a purchase.

2. Security
- No RLS policy changes needed; existing policies remain valid.
*/

ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS cashback_used numeric DEFAULT 0;
