
-- Backfill seller_id on store_products for products created by admin (no seller_id set)
-- Assign to the first admin user as fallback
UPDATE public.store_products
SET seller_id = (
  SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1
)
WHERE seller_id IS NULL;

-- Backfill seller_id on store_orders from store_products (now that products have seller_id)
UPDATE public.store_orders so
SET seller_id = sp.seller_id
FROM public.store_products sp
WHERE so.product_id = sp.id
  AND so.seller_id IS NULL
  AND sp.seller_id IS NOT NULL;
