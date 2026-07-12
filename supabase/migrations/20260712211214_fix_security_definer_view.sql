
-- Fix Security Definer View: product_rating_summary
-- Drop and recreate without SECURITY DEFINER (use SECURITY INVOKER instead)
DROP VIEW IF EXISTS public.product_rating_summary;

CREATE VIEW public.product_rating_summary
WITH (security_invoker = true)
AS
SELECT 
  sp.id,
  sp.name,
  sp.category,
  sp.price_usdt,
  sp.active,
  COALESCE(avg(pr.rating::numeric), 0::numeric) AS average_rating,
  count(pr.id) AS total_ratings,
  count(pr.id) FILTER (WHERE pr.rating = 5) AS five_star_count,
  count(pr.id) FILTER (WHERE pr.rating = 4) AS four_star_count,
  count(pr.id) FILTER (WHERE pr.rating = 3) AS three_star_count,
  count(pr.id) FILTER (WHERE pr.rating = 2) AS two_star_count,
  count(pr.id) FILTER (WHERE pr.rating = 1) AS one_star_count
FROM store_products sp
LEFT JOIN product_ratings pr ON sp.id = pr.product_id
GROUP BY sp.id, sp.name, sp.category, sp.price_usdt, sp.active;
