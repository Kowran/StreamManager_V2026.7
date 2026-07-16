/*
# Fix seller cancellation stock restoration

## Problem
When a seller cancels an order, the `process_seller_cancellation` function only restores
stock if the `user_purchases.credentials` JSON contains an `accounts` array or `email`+`password`
keys with non-empty values. For products that track stock purely via
`store_products.stock_quantity` or `store_product_variations.stock_quantity` (without
`product_inventory` rows), the stock is never restored. This means:
- The product's available stock counter doesn't increase after cancellation.
- The store and product detail pages show incorrect stock counts.

## Fix
1. Always restore stock when `p_return_to_stock = true`, even if `v_purchase IS NULL`
   (using `store_orders` data as fallback).
2. For products with `variation_id`, increment `store_product_variations.stock_quantity`.
3. For non-manual-delivery products without credentials in the expected format,
   increment `store_products.stock_quantity` directly as a fallback.
4. For manual-delivery products, always increment `store_products.stock_quantity`.

## Modified Functions
- `process_seller_cancellation(uuid, text, boolean)` — rewritten to handle all stock
  restoration cases including the fallback path.
*/

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
  v_stock_returned boolean := false;
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

    -- Log the credit transaction
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

    -- Notify the customer
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
  IF p_return_to_stock THEN
    -- Get product info to check if it uses inventory or manual delivery
    SELECT * INTO v_product FROM store_products WHERE id = v_product_id;

    IF v_product IS NOT NULL THEN
      v_credentials := COALESCE(v_purchase.credentials, '{}'::jsonb);

      -- Check if credentials has an accounts array (multi-item purchase)
      IF v_credentials ? 'accounts' THEN
        v_accounts := v_credentials->'accounts';

        -- Insert each account back into product_inventory with variation_id
        FOR v_account IN SELECT * FROM jsonb_array_elements(v_accounts)
        LOOP
          INSERT INTO product_inventory (product_id, variation_id, email, password, instructions, status, created_at)
          VALUES (
            v_product_id,
            v_order.variation_id,
            COALESCE(v_account->>'email', ''),
            COALESCE(v_account->>'password', ''),
            COALESCE(v_account->>'instructions', ''),
            'available',
            now()
          );
        END LOOP;
        v_stock_returned := true;

      -- Single-item purchase with non-empty email and password
      ELSIF v_credentials ? 'email' AND v_credentials ? 'password'
            AND COALESCE(v_credentials->>'email', '') != ''
            AND COALESCE(v_credentials->>'password', '') != '' THEN
        -- Only insert into product_inventory if the product uses inventory (not manual delivery)
        IF v_product.manual_delivery = false OR v_product.manual_delivery IS NULL THEN
          INSERT INTO product_inventory (product_id, variation_id, email, password, instructions, status, created_at)
          VALUES (
            v_product_id,
            v_order.variation_id,
            v_credentials->>'email',
            v_credentials->>'password',
            COALESCE(v_credentials->>'instructions', ''),
            'available',
            now()
          );
        END IF;
        v_stock_returned := true;
      END IF;

      -- For manual delivery products (no inventory rows), increment stock directly
      IF v_product.manual_delivery = true THEN
        UPDATE store_products
        SET stock_quantity = stock_quantity + COALESCE(v_order.quantity, 1),
            updated_at = now()
        WHERE id = v_product_id;
        v_stock_returned := true;
      END IF;

      -- Fallback: if no stock was returned via the above paths, increment stock_quantity directly
      -- This handles products that track stock via stock_quantity without product_inventory rows
      IF NOT v_stock_returned THEN
        UPDATE store_products
        SET stock_quantity = stock_quantity + COALESCE(v_order.quantity, 1),
            updated_at = now()
        WHERE id = v_product_id;

        -- If the order has a variation_id, also increment the variation's stock_quantity
        IF v_order.variation_id IS NOT NULL THEN
          UPDATE store_product_variations
          SET stock_quantity = stock_quantity + COALESCE(v_order.quantity, 1),
              updated_at = now()
          WHERE id = v_order.variation_id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Order cancelled successfully');
END;
$function$;

-- Re-grant execute permissions
GRANT EXECUTE ON FUNCTION public.process_seller_cancellation(uuid, text, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.process_seller_cancellation(uuid, text, boolean) FROM anon;
