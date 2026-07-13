/*
# Fix per-product sales count and cancelled order stock return

## Problems
1. `get_seller_sales_count` and `get_admin_sales_count` count ALL orders for a
   seller/admin, not per-product. Every product from the same seller shows the
   same sales number. They also use COUNT(*) instead of SUM(quantity), so
   multi-unit purchases are undercounted, and they exclude 'completed' status.
2. `process_seller_cancellation` calls `create_notification()` with wrong
   argument order (title where type should be, message where title should be,
   type where message should be) and uses 'order_cancelled' which is not a
   valid notification_type enum value. This crashes the entire function,
   aborting the cancellation, refund, and stock return.
3. `process_seller_cancellation` uses column `transaction_type` which does not
   exist on `credit_transactions` (the column is `type`).
4. `process_seller_cancellation` only inserts inventory back if a row already
   exists in `product_inventory` for that product — if all inventory was sold,
   no row exists and stock is never returned.
5. `process_seller_cancellation` only returns stock for single-item purchases
   (checks `credentials->>'email'`); multi-item purchases store credentials
   in `credentials.accounts[]` array with empty email/password.

## Changes
1. Create new `get_product_sales_count(product_uuid)` function that returns
   SUM(quantity) of non-cancelled orders for a specific product.
2. Fix `process_seller_cancellation`:
   - Correct `create_notification` argument order and use 'order_status' type.
   - Fix `transaction_type` → `type` column name.
   - Handle both single-item and multi-item (accounts array) credential returns.
   - Remove the `SELECT ... LIMIT 1` existence check that blocked stock return.
   - For multi-item: insert one inventory row per account in the accounts array.
   - For products without inventory (manual delivery): increment
     store_products.stock_quantity directly by the order quantity.

## Security
- No RLS policy changes.
- All functions are SECURITY DEFINER with search_path = public.
*/

-- 1. Create per-product sales count function
CREATE OR REPLACE FUNCTION get_product_sales_count(product_uuid uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(quantity), 0)::bigint
  FROM store_orders
  WHERE product_id = product_uuid
    AND status NOT IN ('cancelled', 'refunded', 'disputed')
    AND status IN ('delivered', 'paid', 'processing', 'completed');
$$;

-- 2. Fix process_seller_cancellation function
CREATE OR REPLACE FUNCTION public.process_seller_cancellation(
  p_order_id uuid,
  p_cancellation_reason text,
  p_return_to_stock boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_order RECORD;
  v_purchase RECORD;
  v_seller_id uuid;
  v_product_id uuid;
  v_user_id uuid;
  v_balance numeric;
  v_credentials jsonb;
  v_accounts jsonb;
  v_account jsonb;
  v_product RECORD;
BEGIN
  -- Get the order and verify the caller is the seller
  SELECT * INTO v_order
  FROM store_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.seller_id IS NULL OR v_order.seller_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to cancel this order');
  END IF;

  IF v_order.status = 'cancelled' OR v_order.status = 'refunded' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order is already cancelled');
  END IF;

  v_product_id := v_order.product_id;
  v_user_id := v_order.user_id;

  -- Get seller_id from product (fallback if order.seller_id is null)
  SELECT seller_id INTO v_seller_id FROM store_products WHERE id = v_product_id;

  -- Update order status
  UPDATE store_orders
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancellation_reason = p_cancellation_reason,
      updated_at = now()
  WHERE id = p_order_id;

  -- Get the user purchase record
  SELECT * INTO v_purchase
  FROM user_purchases
  WHERE order_id = p_order_id
  LIMIT 1;

  -- Refund customer credits
  IF v_purchase IS NOT NULL THEN
    -- Get current balance
    SELECT balance INTO v_balance
    FROM user_credits
    WHERE user_id = v_purchase.user_id;

    IF v_balance IS NULL THEN
      v_balance := 0;
    END IF;

    -- Add refund to balance
    UPDATE user_credits
    SET balance = v_balance + v_purchase.purchase_price,
        total_spent = GREATEST(0, COALESCE(total_spent, 0) - v_purchase.purchase_price),
        updated_at = now()
    WHERE user_id = v_purchase.user_id;

    -- If no user_credits row exists, create one
    IF NOT FOUND THEN
      INSERT INTO user_credits (user_id, balance, total_spent, updated_at)
      VALUES (v_purchase.user_id, v_purchase.purchase_price, 0, now())
      ON CONFLICT (user_id) DO UPDATE
      SET balance = user_credits.balance + v_purchase.purchase_price,
          updated_at = now();
    END IF;

    -- Log the credit transaction (fixed: column is 'type' not 'transaction_type')
    INSERT INTO credit_transactions (
      user_id, type, amount, balance_before, balance_after, description, reference_id, reference_type, metadata, created_at
    ) VALUES (
      v_purchase.user_id,
      'refund',
      v_purchase.purchase_price,
      v_balance,
      v_balance + v_purchase.purchase_price,
      'Reembolso - Pedido cancelado pelo vendedor',
      p_order_id,
      'order_cancellation',
      jsonb_build_object(
        'order_id', p_order_id,
        'product_name', v_purchase.product_name,
        'cancelled_by', 'seller',
        'seller_id', auth.uid(),
        'reason', p_cancellation_reason,
        'timestamp', now()
      ),
      now()
    );

    -- Mark purchase as expired
    UPDATE user_purchases
    SET expired = true,
        updated_at = now()
    WHERE order_id = p_order_id;

    -- Notify the customer (fixed: correct argument order and valid enum value)
    PERFORM create_notification(
      v_purchase.user_id,
      'order_status',
      'Pedido Cancelado',
      'Seu pedido para "' || v_purchase.product_name || '" foi cancelado pelo vendedor. O valor de $' || v_purchase.purchase_price || ' foi reembolsado em sua carteira.',
      jsonb_build_object(
        'order_id', p_order_id,
        'product_name', v_purchase.product_name,
        'refund_amount', v_purchase.purchase_price,
        'cancelled_by', 'seller'
      ),
      'high'
    );
  END IF;

  -- Return inventory to stock if requested
  IF p_return_to_stock AND v_purchase IS NOT NULL THEN
    v_credentials := v_purchase.credentials;

    -- Get product info to check if it uses inventory or manual delivery
    SELECT * INTO v_product FROM store_products WHERE id = v_product_id;

    -- Check if credentials has an accounts array (multi-item purchase)
    IF v_credentials ? 'accounts' THEN
      v_accounts := v_credentials->'accounts';

      -- Insert each account back into product_inventory
      FOR v_account IN SELECT * FROM jsonb_array_elements(v_accounts)
      LOOP
        INSERT INTO product_inventory (product_id, email, password, instructions, status, created_at)
        VALUES (
          v_product_id,
          COALESCE(v_account->>'email', ''),
          COALESCE(v_account->>'password', ''),
          COALESCE(v_account->>'instructions', ''),
          'available',
          now()
        );
      END LOOP;
    ELSIF v_credentials ? 'email' AND v_credentials ? 'password' THEN
      -- Single-item purchase with credentials
      -- Only insert into product_inventory if the product uses inventory
      -- (not manual delivery)
      IF v_product.manual_delivery = false OR v_product.manual_delivery IS NULL THEN
        INSERT INTO product_inventory (product_id, email, password, instructions, status, created_at)
        VALUES (
          v_product_id,
          v_credentials->>'email',
          v_credentials->>'password',
          COALESCE(v_credentials->>'instructions', ''),
          'available',
          now()
        );
      END IF;
    END IF;

    -- For manual delivery products (no inventory rows), increment stock directly
    IF v_product.manual_delivery = true THEN
      UPDATE store_products
      SET stock_quantity = stock_quantity + COALESCE(v_order.quantity, 1),
          updated_at = now()
      WHERE id = v_product_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Order cancelled successfully');
END;
$function$;

-- Re-grant execute permissions
GRANT EXECUTE ON FUNCTION public.process_seller_cancellation(uuid, text, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.process_seller_cancellation(uuid, text, boolean) FROM anon;

-- Grant execute on the new per-product count function
GRANT EXECUTE ON FUNCTION get_product_sales_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_sales_count(uuid) TO anon;
