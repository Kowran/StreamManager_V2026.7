/*
# Customer dispute withdrawal function

1. Purpose
   Allows a customer to voluntarily withdraw/cancel an open dispute on an order.
   When a dispute is withdrawn, the order status returns to its prior state (delivered or paid)
   and the support ticket is marked as resolved with resolution_type = 'withdrawn'.

2. New function
   `withdraw_customer_dispute(p_order_id uuid)` — SECURITY DEFINER, executable by authenticated.
   - Verifies the caller is the order's customer (store_orders.user_id = auth.uid()).
   - Only acts on orders currently in 'disputed' status.
   - Sets order status back to 'delivered' (if it had been delivered before) or 'paid'.
   - Clears dispute_opened_at.
   - Marks the latest open seller_support_ticket for this order/customer as resolved
     with resolution_type = 'withdrawn' and resolution_notes explaining the customer withdrew.
   - Unfreezes the commission via the existing trigger (status -> delivered/paid triggers
     the freeze_commission_on_dispute trigger to unfreeze since it's not going to 'cancelled').

3. Security
   - SECURITY DEFINER so it can update store_orders and seller_support_tickets.
   - Executable by authenticated only; anon revoked.
   - search_path set to public.
*/

CREATE OR REPLACE FUNCTION public.withdraw_customer_dispute(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_order RECORD;
  v_prior_status text;
BEGIN
  SELECT * INTO v_order
  FROM store_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.user_id IS NULL OR v_order.user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF v_order.status != 'disputed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order is not in dispute');
  END IF;

  -- Determine the prior status: if delivered_at is set, it was delivered; otherwise paid
  IF v_order.delivered_at IS NOT NULL THEN
    v_prior_status := 'delivered';
  ELSE
    v_prior_status := 'paid';
  END IF;

  -- Restore order status and clear dispute timestamp
  UPDATE store_orders
  SET status = v_prior_status,
      dispute_opened_at = NULL,
      updated_at = now()
  WHERE id = p_order_id;

  -- Mark the latest open support ticket as resolved (withdrawn by customer)
  UPDATE seller_support_tickets
  SET status = 'resolved',
      admin_resolved = true,
      resolution_type = 'withdrawn',
      resolution_notes = 'Cliente desistiu da disputa e cancelou o chamado.',
      resolved_at = now(),
      updated_at = now()
  WHERE order_id = p_order_id
    AND customer_id = auth.uid()
    AND status = 'open'
    AND (admin_resolved IS NULL OR admin_resolved = false);

  RETURN jsonb_build_object('success', true, 'message', 'Dispute withdrawn successfully');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.withdraw_customer_dispute(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.withdraw_customer_dispute(uuid) FROM anon;
