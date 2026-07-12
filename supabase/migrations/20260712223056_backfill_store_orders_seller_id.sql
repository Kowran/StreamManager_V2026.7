
-- Backfill seller_id on store_orders from store_products where missing
UPDATE public.store_orders so
SET seller_id = sp.seller_id
FROM public.store_products sp
WHERE so.product_id = sp.id
  AND so.seller_id IS NULL
  AND sp.seller_id IS NOT NULL;
