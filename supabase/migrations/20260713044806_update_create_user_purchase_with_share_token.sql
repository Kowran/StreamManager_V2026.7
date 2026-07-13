/*
# Update create_user_purchase_from_delivery to generate share_token

1. Changes
- The trigger function now generates a random share_token for each new
  user_purchases row, so every purchase has its own unique unguessable link.
*/

CREATE OR REPLACE FUNCTION public.create_user_purchase_from_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
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
    encode(gen_random_bytes(16), 'hex')
  );
  RETURN NEW;
END;
$function$;
