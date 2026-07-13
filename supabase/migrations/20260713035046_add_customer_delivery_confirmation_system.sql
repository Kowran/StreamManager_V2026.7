/*
# Add 3-day test period with customer delivery confirmation

## Overview
When a customer purchases a product, they have 3 days to test it. During this period:
- The customer can click "Confirm account delivery" to finalize the order early.
- The seller's balance is only withdrawable 3 days after the PURCHASE date (not completion date).
- Contact info (phone/WhatsApp) is shown to both parties.
- Sellers can see which accounts were delivered to each customer.

## Changes

### 1. New columns on `store_orders`
- `customer_contact` (text) — buyer's phone/WhatsApp, saved at purchase time so the seller always has it.
- `delivered_at` (timestamptz) — timestamp when the customer confirmed delivery.

### 2. RLS policy changes
- **Sellers can update own orders** — allows sellers to change order status (delivered → completed) directly.
- **Sellers can view deliveries for own orders** — allows sellers to see the delivered accounts (store_deliveries) for their own orders.

### 3. New RPC: `confirm_customer_delivery(p_order_id)`
- Called by the customer to confirm they received and tested the accounts.
- Sets order status to `completed`, `delivery_confirmed = true`, `delivered_at = now()`.
- This triggers the commission creation (with 3-day hold from purchase date).

### 4. Modified `calculate_sales_commission()` trigger
- Changed `available_at` from `now() + 3 days` to `NEW.created_at + 3 days`.
- This ensures the 3-day hold starts from the PURCHASE date, not the completion date.
- So even if the customer confirms early, the seller still waits until 3 days after purchase.

### 5. New RPC: `auto_complete_expired_orders()`
- Auto-completes orders that are in 'delivered' status for more than 3 days.
- Called by the check-expired-purchases cron or manually.

## Security
- `confirm_customer_delivery` verifies `auth.uid() = order.user_id` (only the buyer can confirm).
- `auto_complete_expired_orders` is admin-only.
- Seller update policy scopes to `seller_id = auth.uid()`.
- Seller delivery view policy joins through `store_orders.seller_id`.
*/

-- 1. Add columns
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS customer_contact text;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- 2. Backfill customer_contact from profiles
UPDATE store_orders so
SET customer_contact = p.phone_number
FROM profiles p
WHERE so.user_id = p.id
  AND so.customer_contact IS NULL
  AND p.phone_number IS NOT NULL;

-- 3. Seller UPDATE policy on store_orders
DROP POLICY IF EXISTS "Sellers can update own orders" ON store_orders;
CREATE POLICY "Sellers can update own orders"
ON store_orders FOR UPDATE
TO authenticated
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid());

-- 4. Seller SELECT policy on store_deliveries
DROP POLICY IF EXISTS "Sellers can view deliveries for own orders" ON store_deliveries;
CREATE POLICY "Sellers can view deliveries for own orders"
ON store_deliveries FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM store_orders so
    WHERE so.id = store_deliveries.order_id AND so.seller_id = auth.uid()
  )
);

-- 5. confirm_customer_delivery RPC
CREATE OR REPLACE FUNCTION public.confirm_customer_delivery(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_order RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_order FROM store_orders WHERE id = p_order_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order already completed');
  END IF;

  IF v_order.status IN ('cancelled', 'refunded') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order is cancelled');
  END IF;

  UPDATE store_orders
  SET status = 'completed',
      delivery_confirmed = true,
      delivered_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'message', 'Delivery confirmed successfully');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.confirm_customer_delivery(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_customer_delivery(uuid) FROM anon;

-- 6. auto_complete_expired_orders RPC (admin-only)
CREATE OR REPLACE FUNCTION public.auto_complete_expired_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_admin_id uuid := auth.uid();
  v_is_admin boolean;
  v_count integer := 0;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT is_admin_user(v_admin_id) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE store_orders
  SET status = 'completed',
      delivery_confirmed = true,
      delivered_at = COALESCE(delivered_at, now()),
      updated_at = now()
  WHERE status = 'delivered'
    AND created_at + interval '3 days' <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'completed_count', v_count);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.auto_complete_expired_orders() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_complete_expired_orders() FROM anon;

-- 7. Modify calculate_sales_commission to use created_at + 3 days for available_at
CREATE OR REPLACE FUNCTION public.calculate_sales_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_seller_id uuid;
  v_config RECORD;
  v_order_total numeric;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT seller_id INTO v_seller_id FROM store_products WHERE id = NEW.product_id;
  IF v_seller_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_config FROM sales_commission_config LIMIT 1;
  IF NOT FOUND THEN
    v_config.admin_commission_rate := 4.00;
    v_config.seller_commission_rate := 96.00;
  END IF;

  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    v_order_total := COALESCE(NEW.total_usdt, 0);
    IF v_order_total > 0 THEN
      INSERT INTO sales_commissions (order_id, seller_id, total_amount, admin_commission_rate, seller_commission_rate, admin_amount, seller_amount, currency, status, available_at)
      VALUES (NEW.id, v_seller_id, v_order_total, v_config.admin_commission_rate, v_config.seller_commission_rate, v_order_total * v_config.admin_commission_rate / 100, v_order_total * v_config.seller_commission_rate / 100, 'USDT', 'pending', NEW.created_at + interval '3 days')
      ON CONFLICT (order_id, currency) DO NOTHING;
    END IF;

    v_order_total := COALESCE(NEW.total_brl, 0);
    IF v_order_total > 0 THEN
      INSERT INTO sales_commissions (order_id, seller_id, total_amount, admin_commission_rate, seller_commission_rate, admin_amount, seller_amount, currency, status, available_at)
      VALUES (NEW.id, v_seller_id, v_order_total, v_config.admin_commission_rate, v_config.seller_commission_rate, v_order_total * v_config.admin_commission_rate / 100, v_order_total * v_config.seller_commission_rate / 100, 'BRL', 'pending', NEW.created_at + interval '3 days')
      ON CONFLICT (order_id, currency) DO NOTHING;
    END IF;
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE sales_commissions SET status = 'cancelled', updated_at = now()
    WHERE order_id = NEW.id AND status IN ('pending', 'frozen');
  END IF;

  RETURN NEW;
END;
$function$;
