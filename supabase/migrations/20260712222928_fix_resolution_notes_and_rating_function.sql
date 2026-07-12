
-- Fix 1: Add resolution_notes column to seller_support_tickets (it's referenced in code but doesn't exist)
ALTER TABLE public.seller_support_tickets ADD COLUMN IF NOT EXISTS resolution_notes text;

-- Fix 2: Fix can_user_rate_product to handle NULL expired correctly
CREATE OR REPLACE FUNCTION public.can_user_rate_product(p_user_id uuid, p_product_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_purchases 
    WHERE user_id = p_user_id 
    AND product_id = p_product_id
    AND (expired IS NULL OR expired = false)
  );
END;
$$;

-- Fix 3: Also allow rating even if product is expired (user did buy it)
CREATE OR REPLACE FUNCTION public.can_user_rate_product(p_user_id uuid, p_product_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_purchases 
    WHERE user_id = p_user_id 
    AND product_id = p_product_id
  );
END;
$$;
