/*
# Add commission freeze on dispute and seller cancellation support

## Problem
1. When a dispute is opened on an order, the seller's commission balance is not frozen — the seller could withdraw earnings from a disputed sale.
2. When a seller cancels an order, no refund, inventory return, or notification happens — only a raw status update.
3. The `sales_commissions` table has no `frozen` status to hold balances during disputes.

## Changes
1. Add `frozen` as a valid status in `sales_commissions.status` CHECK constraint.
2. Create a trigger function `freeze_commission_on_dispute()` that fires AFTER UPDATE on `store_orders` — when status changes to `disputed`, it sets matching `sales_commissions` rows to `frozen`. When the dispute is resolved (status changes back to `completed` or to `cancelled`), it unfreezes (sets back to `pending` or `cancelled` respectively).
3. Create a trigger `trigger_freeze_commission_on_dispute` on `store_orders`.
4. Create a `process_seller_cancellation()` SQL function that handles the full seller cancellation flow: updates order status, sets cancelled_at/by/reason, refunds customer credits, logs credit_transaction, returns inventory to stock, marks user_purchases expired, and notifies the customer.

## Security
- No RLS or policy changes.
- The `process_seller_cancellation` function is SECURITY DEFINER so the seller can call it via RPC, but it verifies `auth.uid()` matches the order's `seller_id`.
*/

-- 1. Add 'frozen' to sales_commissions status constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sales_commissions_status_check'
  ) THEN
    ALTER TABLE sales_commissions DROP CONSTRAINT sales_commissions_status_check;
  END IF;
END $$;

ALTER TABLE sales_commissions ADD CONSTRAINT sales_commissions_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'cancelled'::text, 'frozen'::text]));

-- 2. Create trigger function to freeze/unfreeze commission on dispute
CREATE OR REPLACE FUNCTION public.freeze_commission_on_dispute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  -- When order becomes disputed, freeze the commission
  IF NEW.status = 'disputed' AND OLD.status != 'disputed' THEN
    UPDATE sales_commissions
    SET status = 'frozen'
    WHERE order_id = NEW.id AND status = 'pending';
  END IF;

  -- When dispute is resolved back to completed, unfreeze commission
  IF NEW.status = 'completed' AND OLD.status = 'disputed' THEN
    UPDATE sales_commissions
    SET status = 'pending'
    WHERE order_id = NEW.id AND status = 'frozen';
  END IF;

  -- When disputed order is cancelled, cancel the commission
  IF NEW.status = 'cancelled' AND OLD.status = 'disputed' THEN
    UPDATE sales_commissions
    SET status = 'cancelled'
    WHERE order_id = NEW.id AND status = 'frozen';
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trigger_freeze_commission_on_dispute ON store_orders;
CREATE TRIGGER trigger_freeze_commission_on_dispute
  AFTER UPDATE ON store_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.freeze_commission_on_dispute();

-- 4. Create seller cancellation function
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
  v_inventory_item RECORD;
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
      user_id, amount, transaction_type, description, metadata, created_at
    ) VALUES (
      v_purchase.user_id,
      v_purchase.purchase_price,
      'refund',
      'Reembolso - Pedido cancelado pelo vendedor',
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
      'Pedido Cancelado',
      'Seu pedido para "' || v_purchase.product_name || '" foi cancelado pelo vendedor. O valor de $' || v_purchase.purchase_price || ' foi reembolsado em sua carteira.',
      'order_cancelled',
      jsonb_build_object(
        'order_id', p_order_id,
        'product_name', v_purchase.product_name,
        'refund_amount', v_purchase.purchase_price,
        'cancelled_by', 'seller'
      )
    );
  END IF;

  -- Return inventory to stock if requested
  IF p_return_to_stock AND v_purchase IS NOT NULL THEN
    v_credentials := v_purchase.credentials;

    IF v_credentials ? 'email' AND v_credentials ? 'password' THEN
      -- Check if product_inventory table has this product
      SELECT * INTO v_inventory_item
      FROM product_inventory
      WHERE product_id = v_product_id
      LIMIT 1;

      IF FOUND THEN
        INSERT INTO product_inventory (product_id, email, password, instructions, status, created_at)
        VALUES (
          v_product_id,
          v_credentials->>'email',
          v_credentials->>'password',
          v_credentials->>'instructions',
          'available',
          now()
        );
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Order cancelled successfully');
END;
$function$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.process_seller_cancellation(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.freeze_commission_on_dispute() TO authenticated;

-- Revoke anon execute
REVOKE EXECUTE ON FUNCTION public.process_seller_cancellation(uuid, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.freeze_commission_on_dispute() FROM anon;
