/*
# Fix create_user_purchase_from_delivery search_path

The function `create_user_purchase_from_delivery()` had `SET search_path TO ''`
(empty string), which prevented it from resolving the `user_purchases` table.
This caused the error "relation user_purchases does not exist" whenever a
store delivery was created, breaking all purchases.

1. Changes
- Recreate `create_user_purchase_from_delivery()` with `SET search_path TO public`
  so it can correctly resolve table references.
- No schema changes, no data changes.
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
$function$;
