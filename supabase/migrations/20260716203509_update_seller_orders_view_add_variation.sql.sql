-- Update seller_orders_view to include variation_name
CREATE OR REPLACE VIEW seller_orders_view AS
SELECT 
  id, user_id, product_id, quantity, total_brl, total_usdt, status,
  customer_name, delivery_data, created_at, updated_at,
  cancelled_at, cancelled_by, cancellation_reason,
  seller_id, coupon_id, discount_amount, recharge_data,
  delivery_confirmed, cashback_used, dispute_opened_at, delivered_at,
  variation_id, variation_name
FROM store_orders;
