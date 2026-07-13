-- Fix create_user_purchase_from_delivery: add search_path so gen_random_bytes resolves via pgcrypto
CREATE OR REPLACE FUNCTION create_user_purchase_from_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO user_purchases (
    user_id,
    order_id,
    product_id,
    product_name,
    purchase_price,
    credentials,
    purchase_date,
    share_token
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
    NOW(),
    encode(extensions.gen_random_bytes(16), 'hex')
  );
  RETURN NEW;
END;
$$;
