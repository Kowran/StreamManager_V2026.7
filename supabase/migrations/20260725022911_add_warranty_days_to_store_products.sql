/*
# Add warranty period to products

1. Schema Changes
- Add `warranty_days` column to `store_products` (integer, nullable). When set,
  the seller offers a warranty of either 15 or 30 days on the product. NULL
  means the seller has not selected a warranty period.

2. Security
- No new tables. `warranty_days` is readable by anyone who can read the product
  (existing store_products SELECT policies already cover anon + authenticated).
  Updates are governed by the existing seller ownership policies on store_products.
*/

ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS warranty_days integer;
