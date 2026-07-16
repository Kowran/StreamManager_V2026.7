/*
# Admin Dispute Resolution System

## Changes
1. Allow 'admin' as a sender_type in seller_support_messages (alter CHECK constraint).
2. Add admin RLS policies on seller_support_tickets (read all, update for resolution).
3. Add admin RLS policies on seller_support_messages (read all, insert as admin).
4. Create admin_resolve_seller_ticket() RPC for admin to resolve/cancel/refund/force-resolve tickets.

## Security
- All RPC functions are SECURITY DEFINER, admin-only (is_admin_user() check).
- RLS policies use is_admin_user() for admin access.
- is_admin_user() takes no arguments — uses auth.uid() internally.
*/

-- 1. Allow 'admin' sender_type in seller_support_messages
ALTER TABLE public.seller_support_messages
  DROP CONSTRAINT IF EXISTS seller_support_messages_sender_type_check;
ALTER TABLE public.seller_support_messages
  ADD CONSTRAINT seller_support_messages_sender_type_check
  CHECK (sender_type IN ('customer', 'seller', 'admin'));

-- 2. Admin RLS policies on seller_support_tickets
CREATE POLICY "admin_read_all_seller_support_tickets"
  ON public.seller_support_tickets FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

CREATE POLICY "admin_update_seller_support_tickets"
  ON public.seller_support_tickets FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- 3. Admin RLS policies on seller_support_messages
CREATE POLICY "admin_read_all_seller_support_messages"
  ON public.seller_support_messages FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

CREATE POLICY "admin_insert_seller_support_messages"
  ON public.seller_support_messages FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user());

-- 4. admin_resolve_seller_ticket() RPC
CREATE OR REPLACE FUNCTION public.admin_resolve_seller_ticket(
  p_ticket_id uuid,
  p_action text,
  p_resolution_notes text DEFAULT NULL,
  p_resolution_type text DEFAULT NULL,
  p_replacement_credentials jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_admin_id uuid := auth.uid();
  v_is_admin boolean;
  v_ticket RECORD;
  v_order RECORD;
  v_customer_id uuid;
  v_refund_amount numeric;
  v_existing_credit RECORD;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT public.is_admin_user() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_ticket FROM seller_support_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found');
  END IF;

  IF p_action = 'resolve' THEN
    UPDATE seller_support_tickets
    SET status = 'resolved',
        admin_resolved = true,
        resolution_notes = COALESCE(p_resolution_notes, 'Resolved by admin'),
        resolution_type = COALESCE(p_resolution_type, v_ticket.resolution_type),
        replacement_credentials = COALESCE(p_replacement_credentials, v_ticket.replacement_credentials),
        resolved_at = now(),
        updated_at = now()
    WHERE id = p_ticket_id;

    IF v_ticket.order_id IS NOT NULL THEN
      UPDATE store_orders SET status = 'completed', updated_at = now()
        WHERE id = v_ticket.order_id AND status = 'disputed';
    END IF;

    PERFORM create_notification(
      v_ticket.seller_id, 'support', 'Disputa Resolvida pelo Admin',
      'O administrador resolveu o ticket ' || v_ticket.ticket_number || '.',
      jsonb_build_object('ticket_id', p_ticket_id)
    );
    IF v_ticket.customer_id IS NOT NULL THEN
      PERFORM create_notification(
        v_ticket.customer_id, 'support', 'Disputa Resolvida pelo Admin',
        'O administrador resolveu o ticket ' || v_ticket.ticket_number || '.',
        jsonb_build_object('ticket_id', p_ticket_id)
      );
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Ticket resolved by admin');

  ELSIF p_action = 'cancel_sale' THEN
    IF v_ticket.order_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'No order linked to this ticket');
    END IF;

    SELECT * INTO v_order FROM store_orders WHERE id = v_ticket.order_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    v_customer_id := v_order.user_id;
    v_refund_amount := COALESCE(v_order.total_usdt, 0);

    UPDATE store_orders SET status = 'cancelled', updated_at = now()
      WHERE id = v_ticket.order_id;

    UPDATE sales_commissions SET status = 'cancelled', updated_at = now()
      WHERE order_id = v_ticket.order_id;

    IF v_order.product_id IS NOT NULL AND v_order.quantity IS NOT NULL AND v_order.quantity > 0 THEN
      UPDATE store_products
        SET stock = stock + v_order.quantity
        WHERE id = v_order.product_id AND stock IS NOT NULL;
    END IF;

    IF v_customer_id IS NOT NULL AND v_refund_amount > 0 THEN
      SELECT * INTO v_existing_credit FROM user_credits WHERE user_id = v_customer_id;
      IF FOUND THEN
        UPDATE user_credits SET balance = balance + v_refund_amount, updated_at = now()
          WHERE user_id = v_customer_id;
      ELSE
        INSERT INTO user_credits (user_id, balance) VALUES (v_customer_id, v_refund_amount);
      END IF;
    END IF;

    UPDATE seller_support_tickets
    SET status = 'resolved',
        admin_resolved = true,
        resolution_notes = COALESCE(p_resolution_notes, 'Sale cancelled and customer refunded by admin'),
        resolution_type = 'refund',
        resolved_at = now(),
        updated_at = now()
    WHERE id = p_ticket_id;

    PERFORM create_notification(
      v_ticket.seller_id, 'support', 'Venda Cancelada pelo Admin',
      'O administrador cancelou a venda do ticket ' || v_ticket.ticket_number || ' e reembolsou o cliente.',
      jsonb_build_object('ticket_id', p_ticket_id, 'action', 'cancel_sale')
    );
    IF v_customer_id IS NOT NULL THEN
      PERFORM create_notification(
        v_customer_id, 'support', 'Reembolso Creditado',
        'Sua compra foi cancelada e ' || v_refund_amount || ' USDT foi creditado em sua conta.',
        jsonb_build_object('ticket_id', p_ticket_id, 'action', 'refund', 'amount', v_refund_amount)
      );
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Sale cancelled and customer refunded');

  ELSIF p_action = 'refund_customer' THEN
    IF v_ticket.order_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'No order linked to this ticket');
    END IF;

    SELECT * INTO v_order FROM store_orders WHERE id = v_ticket.order_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    v_customer_id := v_order.user_id;
    v_refund_amount := COALESCE(v_order.total_usdt, 0);

    IF v_customer_id IS NOT NULL AND v_refund_amount > 0 THEN
      SELECT * INTO v_existing_credit FROM user_credits WHERE user_id = v_customer_id;
      IF FOUND THEN
        UPDATE user_credits SET balance = balance + v_refund_amount, updated_at = now()
          WHERE user_id = v_customer_id;
      ELSE
        INSERT INTO user_credits (user_id, balance) VALUES (v_customer_id, v_refund_amount);
      END IF;
    END IF;

    UPDATE seller_support_tickets
    SET status = 'resolved',
        admin_resolved = true,
        resolution_notes = COALESCE(p_resolution_notes, 'Customer refunded by admin'),
        resolution_type = 'refund',
        resolved_at = now(),
        updated_at = now()
    WHERE id = p_ticket_id;

    UPDATE store_orders SET status = 'completed', updated_at = now()
      WHERE id = v_ticket.order_id AND status = 'disputed';

    PERFORM create_notification(
      v_ticket.seller_id, 'support', 'Cliente Reembolsado pelo Admin',
      'O administrador reembolsou o cliente do ticket ' || v_ticket.ticket_number || '.',
      jsonb_build_object('ticket_id', p_ticket_id, 'action', 'refund')
    );
    IF v_customer_id IS NOT NULL THEN
      PERFORM create_notification(
        v_customer_id, 'support', 'Reembolso Creditado',
        v_refund_amount || ' USDT foi creditado em sua conta.',
        jsonb_build_object('ticket_id', p_ticket_id, 'action', 'refund', 'amount', v_refund_amount)
      );
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Customer refunded');

  ELSIF p_action = 'force_seller' THEN
    UPDATE seller_support_tickets
    SET status = 'resolved',
        admin_resolved = true,
        resolution_notes = COALESCE(p_resolution_notes, 'Admin decided in favor of seller'),
        resolved_at = now(),
        updated_at = now()
    WHERE id = p_ticket_id;

    IF v_ticket.order_id IS NOT NULL THEN
      UPDATE store_orders SET status = 'completed', updated_at = now()
        WHERE id = v_ticket.order_id AND status = 'disputed';
      UPDATE sales_commissions SET status = 'pending', updated_at = now()
        WHERE order_id = v_ticket.order_id AND status = 'frozen';
    END IF;

    PERFORM create_notification(
      v_ticket.seller_id, 'support', 'Disputa Resolvida - A seu Favor',
      'O administrador resolveu o ticket ' || v_ticket.ticket_number || ' a seu favor.',
      jsonb_build_object('ticket_id', p_ticket_id, 'action', 'force_seller')
    );
    IF v_ticket.customer_id IS NOT NULL THEN
      PERFORM create_notification(
        v_ticket.customer_id, 'support', 'Disputa Encerrada',
        'O administrador encerrou o ticket ' || v_ticket.ticket_number || '.',
        jsonb_build_object('ticket_id', p_ticket_id, 'action', 'force_seller')
      );
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Resolved in favor of seller');

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_resolve_seller_ticket(uuid, text, text, text, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_seller_ticket(uuid, text, text, text, jsonb) FROM anon;
