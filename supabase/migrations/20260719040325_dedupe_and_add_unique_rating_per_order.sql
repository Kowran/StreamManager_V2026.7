-- Remove duplicate product_ratings per (user_id, order_id), keeping the latest
WITH dups AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id, order_id ORDER BY created_at DESC) AS rn
  FROM product_ratings
  WHERE order_id IS NOT NULL
)
DELETE FROM product_ratings
WHERE id IN (SELECT id FROM dups WHERE rn > 1);

-- Prevent future duplicate ratings per order
ALTER TABLE product_ratings
  ADD CONSTRAINT product_ratings_user_order_unique UNIQUE (user_id, order_id);
