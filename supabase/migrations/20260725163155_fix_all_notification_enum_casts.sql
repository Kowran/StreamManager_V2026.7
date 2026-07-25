-- Fix: Several trigger/helper functions called create_notification() with
-- uncast string literals for the notification_type and notification_priority
-- enum parameters. PostgreSQL resolves these literals as type "unknown" inside
-- CASE expressions and plain argument lists, so it cannot match the function
-- signature, raising:
--   "function create_notification(uuid, unknown, text, text, jsonb, text,
--    timestamp with time zone) does not exist"
-- This broke ticket messages, delivery/payment notifications, account expiry
-- reminders, admin dispute resolution, and seller cancellations.
-- Add explicit :: casts on every enum literal so the types resolve correctly.

-- 1. notify_delivery_completed
CREATE OR REPLACE FUNCTION public.notify_delivery_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  product_name text;
  user_language text;
BEGIN
  SELECT language INTO user_language
  FROM profiles
  WHERE id = NEW.user_id;

  user_language := COALESCE(user_language, 'pt');

  product_name := COALESCE(
    NEW.delivery_content->>'product_name',
    CASE user_language
      WHEN 'en' THEN 'Product'
      WHEN 'es' THEN 'Producto'
      ELSE 'Produto'
    END
  );

  PERFORM create_notification(
    NEW.user_id,
    'delivery'::notification_type,
    '🎉 ' || get_notification_text('product_delivered', user_language),
    format(get_notification_text('product_delivered_msg', user_language), product_name),
    jsonb_build_object(
      'delivery_id', NEW.id,
      'order_id', NEW.order_id,
      'product_name', product_name,
      'delivery_method', NEW.delivery_method
    ),
    'high'::notification_priority,
    now() + interval '7 days'
  );

  RETURN NEW;
END;
$function$;

-- 2. notify_payment_completed
CREATE OR REPLACE FUNCTION public.notify_payment_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_language text;
BEGIN
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    SELECT language INTO user_language
    FROM profiles
    WHERE id = NEW.user_id;

    user_language := COALESCE(user_language, 'pt');

    PERFORM create_notification(
      NEW.user_id,
      'payment'::notification_type,
      '💰 ' || get_notification_text('recharge_completed', user_language),
      format(get_notification_text('recharge_completed_msg', user_language), NEW.total_credits),
      jsonb_build_object(
        'recharge_id', NEW.id,
        'amount', NEW.total_credits,
        'payment_method', NEW.payment_method,
        'completed_at', NEW.completed_at
      ),
      'high'::notification_priority,
      now() + interval '3 days'
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. notify_accounts_access_expiry
CREATE OR REPLACE FUNCTION public.notify_accounts_access_expiry()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  access_record record;
  notification_count integer := 0;
  days_until_expiry integer;
  user_language text;
  notification_title text;
  notification_message text;
  plural_suffix text;
BEGIN
  FOR access_record IN
    SELECT 
      aap.*,
      p.email,
      p.full_name,
      p.language
    FROM accounts_access_purchases aap
    JOIN profiles p ON p.id = aap.user_id
    WHERE aap.active = true
      AND aap.expires_at > now()
      AND aap.expires_at <= now() + interval '7 days'
  LOOP
    days_until_expiry := EXTRACT(days FROM (access_record.expires_at - now()));
    user_language := COALESCE(access_record.language, 'pt');

    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = access_record.user_id
        AND type = 'accounts_access_expiry'
        AND data->>'access_id' = access_record.id::text
        AND created_at >= CURRENT_DATE
    ) THEN
      plural_suffix := CASE WHEN days_until_expiry > 1 THEN 's' ELSE '' END;

      IF days_until_expiry <= 1 THEN
        notification_title := '🚨 ' || get_notification_text('access_expiring_today', user_language);
        notification_message := get_notification_text('access_expiring_today_msg', user_language);
      ELSIF days_until_expiry <= 3 THEN
        notification_title := '⚠️ ' || get_notification_text('access_expiring_soon', user_language);
        notification_message := format(
          get_notification_text('access_expiring_soon_msg', user_language),
          days_until_expiry, 
          plural_suffix
        );
      ELSE
        notification_title := '📅 ' || get_notification_text('access_reminder', user_language);
        notification_message := format(
          get_notification_text('access_reminder_msg', user_language),
          days_until_expiry
        );
      END IF;

      PERFORM create_notification(
        access_record.user_id,
        'accounts_access_expiry'::notification_type,
        notification_title,
        notification_message,
        jsonb_build_object(
          'access_id', access_record.id,
          'expires_at', access_record.expires_at,
          'days_until_expiry', days_until_expiry
        ),
        CASE 
          WHEN days_until_expiry <= 1 THEN 'urgent'::notification_priority
          WHEN days_until_expiry <= 3 THEN 'high'::notification_priority
          ELSE 'medium'::notification_priority
        END,
        access_record.expires_at + interval '1 day'
      );

      notification_count := notification_count + 1;
    END IF;
  END LOOP;

  RETURN notification_count;
END;
$function$;

-- 4. notify_streaming_account_expiry
CREATE OR REPLACE FUNCTION public.notify_streaming_account_expiry()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  account_record record;
  notification_count integer := 0;
  days_until_expiry integer;
  user_language text;
  notification_title text;
  notification_message text;
  plural_suffix text;
BEGIN
  FOR account_record IN
    SELECT 
      sa.*,
      ss.name as service_name,
      p.email,
      p.full_name,
      p.language
    FROM streaming_accounts sa
    JOIN streaming_services ss ON ss.id = sa.service_id
    JOIN profiles p ON p.id = sa.user_id
    WHERE sa.status = 'active'
      AND sa.expiry_date IS NOT NULL
      AND sa.expiry_date > CURRENT_DATE
      AND sa.expiry_date <= CURRENT_DATE + interval '7 days'
  LOOP
    days_until_expiry := EXTRACT(days FROM (account_record.expiry_date::timestamp - now()));
    user_language := COALESCE(account_record.language, 'pt');

    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = account_record.user_id
        AND type = 'account_expiry'
        AND data->>'account_id' = account_record.id::text
        AND created_at >= CURRENT_DATE
    ) THEN
      plural_suffix := CASE WHEN days_until_expiry > 1 THEN 's' ELSE '' END;

      IF days_until_expiry <= 1 THEN
        notification_title := '🚨 ' || get_notification_text('account_expiring_today', user_language);
        notification_message := format(
          get_notification_text('account_expiring_today_msg', user_language),
          account_record.service_name, 
          account_record.email
        );
      ELSIF days_until_expiry <= 3 THEN
        notification_title := '⚠️ ' || get_notification_text('account_expiring_soon', user_language);
        notification_message := format(
          get_notification_text('account_expiring_soon_msg', user_language),
          account_record.service_name, 
          account_record.email,
          days_until_expiry, 
          plural_suffix
        );
      ELSE
        notification_title := '📅 ' || get_notification_text('account_expiration_reminder', user_language);
        notification_message := format(
          get_notification_text('account_expiration_reminder_msg', user_language),
          account_record.service_name,
          account_record.email,
          days_until_expiry,
          plural_suffix
        );
      END IF;

      PERFORM create_notification(
        account_record.user_id,
        'account_expiry'::notification_type,
        notification_title,
        notification_message,
        jsonb_build_object(
          'account_id', account_record.id,
          'service_name', account_record.service_name,
          'account_email', account_record.email,
          'expiry_date', account_record.expiry_date,
          'days_until_expiry', days_until_expiry
        ),
        CASE 
          WHEN days_until_expiry <= 1 THEN 'urgent'::notification_priority
          WHEN days_until_expiry <= 3 THEN 'high'::notification_priority
          ELSE 'medium'::notification_priority
        END,
        account_record.expiry_date::timestamp + interval '1 day'
      );

      notification_count := notification_count + 1;
    END IF;
  END LOOP;

  RETURN notification_count;
END;
$function$;

-- 5. admin_resolve_seller_ticket
CREATE OR REPLACE FUNCTION public.admin_resolve_seller_ticket(p_ticket_id uuid, p_action text, p_resolution_notes text DEFAULT NULL::text, p_resolution_type text DEFAULT NULL::text, p_replacement_credentials jsonb DEFAULT NULL::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
      v_ticket.seller_id, 'support'::notification_type, 'Disputa Resolvida pelo Admin',
      'O administrador resolveu o ticket ' || v_ticket.ticket_number || '.',
      jsonb_build_object('ticket_id', p_ticket_id)
    );
    IF v_ticket.customer_id IS NOT NULL THEN
      PERFORM create_notification(
        v_ticket.customer_id, 'support'::notification_type, 'Disputa Resolvida pelo Admin',
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
      v_ticket.seller_id, 'support'::notification_type, 'Venda Cancelada pelo Admin',
      'O administrador cancelou a venda do ticket ' || v_ticket.ticket_number || ' e reembolsou o cliente.',
      jsonb_build_object('ticket_id', p_ticket_id, 'action', 'cancel_sale')
    );
    IF v_customer_id IS NOT NULL THEN
      PERFORM create_notification(
        v_customer_id, 'support'::notification_type, 'Reembolso Creditado',
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
      v_ticket.seller_id, 'support'::notification_type, 'Cliente Reembolsado pelo Admin',
      'O administrador reembolsou o cliente do ticket ' || v_ticket.ticket_number || '.',
      jsonb_build_object('ticket_id', p_ticket_id, 'action', 'refund')
    );
    IF v_customer_id IS NOT NULL THEN
      PERFORM create_notification(
        v_customer_id, 'support'::notification_type, 'Reembolso Creditado',
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
      v_ticket.seller_id, 'support'::notification_type, 'Disputa Resolvida - A seu Favor',
      'O administrador resolveu o ticket ' || v_ticket.ticket_number || ' a seu favor.',
      jsonb_build_object('ticket_id', p_ticket_id, 'action', 'force_seller')
    );
    IF v_ticket.customer_id IS NOT NULL THEN
      PERFORM create_notification(
        v_ticket.customer_id, 'support'::notification_type, 'Disputa Encerrada',
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

-- 6. process_seller_cancellation (only the create_notification call needs casting)
CREATE OR REPLACE FUNCTION public.process_seller_cancellation(p_order_id uuid, p_cancellation_reason text, p_return_to_stock boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  SELECT seller_id INTO v_seller_id FROM store_products WHERE id = v_product_id;

  UPDATE store_orders
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancellation_reason = p_cancellation_reason,
      updated_at = now()
  WHERE id = p_order_id;

  SELECT * INTO v_purchase
  FROM user_purchases
  WHERE order_id = p_order_id
  LIMIT 1;

  IF v_purchase IS NOT NULL THEN
    SELECT balance INTO v_balance
    FROM user_credits
    WHERE user_id = v_purchase.user_id;

    IF v_balance IS NULL THEN
      v_balance := 0;
    END IF;

    UPDATE user_credits
    SET balance = v_balance + v_purchase.purchase_price,
        total_spent = GREATEST(0, COALESCE(total_spent, 0) - v_purchase.purchase_price),
        updated_at = now()
    WHERE user_id = v_purchase.user_id;

    IF NOT FOUND THEN
      INSERT INTO user_credits (user_id, balance, total_spent, updated_at)
      VALUES (v_purchase.user_id, v_purchase.purchase_price, 0, now())
      ON CONFLICT (user_id) DO UPDATE
      SET balance = user_credits.balance + v_purchase.purchase_price,
          updated_at = now();
    END IF;

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

    UPDATE user_purchases
    SET expired = true,
        updated_at = now()
    WHERE order_id = p_order_id;

    PERFORM create_notification(
      v_purchase.user_id,
      'order_status'::notification_type,
      'Pedido Cancelado',
      'Seu pedido para "' || v_purchase.product_name || '" foi cancelado pelo vendedor. O valor de $' || v_purchase.purchase_price || ' foi reembolsado em sua carteira.',
      jsonb_build_object(
        'order_id', p_order_id,
        'product_name', v_purchase.product_name,
        'refund_amount', v_purchase.purchase_price,
        'cancelled_by', 'seller'
      ),
      'high'::notification_priority
    );
  END IF;

  IF p_return_to_stock THEN
    SELECT * INTO v_product FROM store_products WHERE id = v_product_id;

    IF v_product IS NOT NULL THEN
      v_credentials := COALESCE(v_purchase.credentials, '{}'::jsonb);

      IF v_credentials ? 'accounts' THEN
        v_accounts := v_credentials->'accounts';

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

      ELSIF v_credentials ? 'email' AND v_credentials ? 'password'
        AND COALESCE(v_credentials->>'email', '') != ''
        AND COALESCE(v_credentials->>'password', '') != '' THEN
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

      IF v_product.manual_delivery = true THEN
        UPDATE store_products
        SET stock_quantity = stock_quantity + COALESCE(v_order.quantity, 1),
            updated_at = now()
        WHERE id = v_product_id;
        v_stock_returned := true;
      END IF;

      IF NOT v_stock_returned THEN
        UPDATE store_products
        SET stock_quantity = stock_quantity + COALESCE(v_order.quantity, 1),
            updated_at = now()
        WHERE id = v_product_id;

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
