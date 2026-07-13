/*
  # Fix automatic delivery system

  1. Updates
    - Remove old automatic delivery trigger that wasn't working properly
    - The delivery is now handled directly in the application code for better control
    - Keep the user purchase trigger for purchase history

  2. Security
    - Maintain existing RLS policies
    - Ensure proper data integrity
*/

-- Remove the old automatic delivery trigger if it exists
DROP TRIGGER IF EXISTS trigger_automatic_delivery ON store_orders;

-- Keep the user purchase creation trigger as it's working correctly
-- This trigger creates records in user_purchases table when deliveries are made

-- Ensure the trigger function exists and is working properly
CREATE OR REPLACE FUNCTION create_user_purchase_from_delivery()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user purchase record when delivery is created
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
    jsonb_build_object(
      'email', NEW.delivery_content->>'email',
      'password', NEW.delivery_content->>'password',
      'instructions', NEW.delivery_content->>'instructions',
      'accounts', NEW.delivery_content->'accounts',
      'quantity', NEW.delivery_content->'quantity'
    ),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists on store_deliveries
DROP TRIGGER IF EXISTS trigger_create_user_purchase ON store_deliveries;
CREATE TRIGGER trigger_create_user_purchase
  AFTER INSERT ON store_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION create_user_purchase_from_delivery();