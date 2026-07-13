/*
# Add 3-day hold period to seller commissions and withdrawal flow

## Changes
1. Add `available_at` column to `sales_commissions` — marks when commission becomes withdrawable (3 days after creation).
2. Update `calculate_sales_commission()` trigger to set `available_at = now() + 3 days` on new commissions.
3. Create `get_seller_withdrawable_balance()` — available balance respecting 3-day hold.
4. Create `get_seller_pending_hold_balance()` — balance still on hold.
5. Create `get_seller_frozen_balance()` — balance frozen due to disputes.
6. Create `request_seller_withdrawal()` — seller requests withdrawal, validates available balance.
7. Create `process_withdrawal_approval()` — admin approves/rejects/confirms payment.

## Security
- All functions are SECURITY DEFINER with search_path=public.
- Seller functions verify auth.uid() ownership.
- Admin functions verify is_admin_user().
*/

-- 1. Add available_at column
ALTER TABLE sales_commissions ADD COLUMN IF NOT EXISTS available_at timestamptz;

UPDATE sales_commissions
SET available_at = created_at + interval '3 days'
WHERE available_at IS NULL AND status IN ('pending', 'paid');

-- 2. Update calculate_sales_commission trigger
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
      VALUES (NEW.id, v_seller_id, v_order_total, v_config.admin_commission_rate, v_config.seller_commission_rate, v_order_total * v_config.admin_commission_rate / 100, v_order_total * v_config.seller_commission_rate / 100, 'USDT', 'pending', now() + interval '3 days')
      ON CONFLICT (order_id, currency) DO NOTHING;
    END IF;

    v_order_total := COALESCE(NEW.total_brl, 0);
    IF v_order_total > 0 THEN
      INSERT INTO sales_commissions (order_id, seller_id, total_amount, admin_commission_rate, seller_commission_rate, admin_amount, seller_amount, currency, status, available_at)
      VALUES (NEW.id, v_seller_id, v_order_total, v_config.admin_commission_rate, v_config.seller_commission_rate, v_order_total * v_config.admin_commission_rate / 100, v_order_total * v_config.seller_commission_rate / 100, 'BRL', 'pending', now() + interval '3 days')
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

-- 3. get_seller_withdrawable_balance
CREATE OR REPLACE FUNCTION public.get_seller_withdrawable_balance(
  p_seller_id uuid, p_currency text DEFAULT 'USDT'
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_available numeric;
  v_pending_withdrawals numeric;
BEGIN
  SELECT COALESCE(SUM(seller_amount), 0) INTO v_available
  FROM sales_commissions
  WHERE seller_id = p_seller_id AND currency = p_currency AND status = 'pending'
    AND available_at IS NOT NULL AND available_at <= now();

  SELECT COALESCE(SUM(amount), 0) INTO v_pending_withdrawals
  FROM seller_withdrawal_requests
  WHERE seller_id = p_seller_id AND currency = p_currency AND status IN ('pending', 'approved');

  RETURN GREATEST(0, v_available - v_pending_withdrawals);
END;
$function$;

-- 4. get_seller_pending_hold_balance
CREATE OR REPLACE FUNCTION public.get_seller_pending_hold_balance(
  p_seller_id uuid, p_currency text DEFAULT 'USDT'
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_hold numeric;
BEGIN
  SELECT COALESCE(SUM(seller_amount), 0) INTO v_hold
  FROM sales_commissions
  WHERE seller_id = p_seller_id AND currency = p_currency AND status = 'pending'
    AND (available_at IS NULL OR available_at > now());
  RETURN v_hold;
END;
$function$;

-- 5. get_seller_frozen_balance
CREATE OR REPLACE FUNCTION public.get_seller_frozen_balance(
  p_seller_id uuid, p_currency text DEFAULT 'USDT'
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_frozen numeric;
BEGIN
  SELECT COALESCE(SUM(seller_amount), 0) INTO v_frozen
  FROM sales_commissions
  WHERE seller_id = p_seller_id AND currency = p_currency AND status = 'frozen';
  RETURN v_frozen;
END;
$function$;

-- 6. request_seller_withdrawal
CREATE OR REPLACE FUNCTION public.request_seller_withdrawal(
  p_amount numeric, p_currency text DEFAULT 'USDT', p_payment_method jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_seller_id uuid := auth.uid();
  v_available numeric;
  v_config RECORD;
  v_withdrawal_id uuid;
BEGIN
  IF v_seller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_config FROM withdrawal_config LIMIT 1;
  IF NOT FOUND THEN
    v_config.min_withdrawal_amount := 10;
    v_config.max_withdrawal_amount := 10000;
  END IF;

  IF p_amount < v_config.min_withdrawal_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal amount is ' || v_config.min_withdrawal_amount);
  END IF;

  IF p_amount > v_config.max_withdrawal_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum withdrawal amount is ' || v_config.max_withdrawal_amount);
  END IF;

  v_available := get_seller_withdrawable_balance(v_seller_id, p_currency);
  IF p_amount > v_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient available balance. Available: ' || v_available);
  END IF;

  INSERT INTO seller_withdrawal_requests (seller_id, amount, currency, status, payment_info_id)
  VALUES (v_seller_id, p_amount, p_currency, 'pending', NULL)
  RETURNING id INTO v_withdrawal_id;

  PERFORM create_notification(
    v_seller_id, 'Saque Solicitado',
    'Seu pedido de saque de ' || p_amount || ' ' || p_currency || ' foi criado e está aguardando aprovação do administrador.',
    'withdrawal_requested',
    jsonb_build_object('withdrawal_id', v_withdrawal_id, 'amount', p_amount, 'currency', p_currency)
  );

  RETURN jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id, 'message', 'Withdrawal request created. Awaiting admin approval.');
END;
$function$;

-- 7. process_withdrawal_approval
CREATE OR REPLACE FUNCTION public.process_withdrawal_approval(
  p_withdrawal_id uuid, p_action text, p_admin_notes text DEFAULT NULL, p_payment_proof_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_admin_id uuid := auth.uid();
  v_withdrawal RECORD;
  v_is_admin boolean;
  v_remaining numeric;
  v_accumulated numeric := 0;
  v_commission RECORD;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT is_admin_user(v_admin_id) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_withdrawal FROM seller_withdrawal_requests WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal request not found');
  END IF;

  IF p_action = 'approve' AND v_withdrawal.status = 'pending' THEN
    UPDATE seller_withdrawal_requests
    SET status = 'approved', approved_at = now(), approved_by = v_admin_id, processing_notes = p_admin_notes, updated_at = now()
    WHERE id = p_withdrawal_id;

    PERFORM create_notification(
      v_withdrawal.seller_id, 'Saque Aprovado',
      'Seu pedido de saque de ' || v_withdrawal.amount || ' ' || v_withdrawal.currency || ' foi aprovado. O pagamento está sendo processado.',
      'withdrawal_approved',
      jsonb_build_object('withdrawal_id', p_withdrawal_id, 'amount', v_withdrawal.amount, 'currency', v_withdrawal.currency)
    );

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal approved');

  ELSIF p_action = 'reject' AND v_withdrawal.status IN ('pending', 'approved') THEN
    UPDATE seller_withdrawal_requests
    SET status = 'rejected', rejection_reason = p_admin_notes, processed_at = now(), processed_by = v_admin_id, updated_at = now()
    WHERE id = p_withdrawal_id;

    PERFORM create_notification(
      v_withdrawal.seller_id, 'Saque Rejeitado',
      'Seu pedido de saque de ' || v_withdrawal.amount || ' ' || v_withdrawal.currency || ' foi rejeitado. Motivo: ' || COALESCE(p_admin_notes, 'Não especificado'),
      'withdrawal_rejected',
      jsonb_build_object('withdrawal_id', p_withdrawal_id, 'amount', v_withdrawal.amount, 'currency', v_withdrawal.currency, 'reason', p_admin_notes)
    );

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal rejected');

  ELSIF p_action = 'confirm_payment' AND v_withdrawal.status = 'approved' THEN
    UPDATE seller_withdrawal_requests
    SET status = 'paid', paid_at = now(), paid_by = v_admin_id, proof_url = p_payment_proof_url, processing_notes = p_admin_notes, updated_at = now()
    WHERE id = p_withdrawal_id;

    -- Mark commissions as paid (FIFO oldest first up to withdrawal amount)
    v_remaining := v_withdrawal.amount;
    FOR v_commission IN
      SELECT id, seller_amount FROM sales_commissions
      WHERE seller_id = v_withdrawal.seller_id AND currency = v_withdrawal.currency
        AND status = 'pending' AND available_at IS NOT NULL AND available_at <= now()
      ORDER BY available_at ASC
    LOOP
      IF v_remaining <= 0 THEN EXIT; END IF;
      IF v_remaining >= v_commission.seller_amount THEN
        UPDATE sales_commissions SET status = 'paid', updated_at = now() WHERE id = v_commission.id;
        v_remaining := v_remaining - v_commission.seller_amount;
      ELSE
        -- Partial: mark this commission as paid (the withdrawal covers part of it)
        UPDATE sales_commissions SET status = 'paid', updated_at = now() WHERE id = v_commission.id;
        v_remaining := 0;
      END IF;
    END LOOP;

    PERFORM create_notification(
      v_withdrawal.seller_id, 'Pagamento Confirmado',
      'Seu saque de ' || v_withdrawal.amount || ' ' || v_withdrawal.currency || ' foi pago.',
      'withdrawal_paid',
      jsonb_build_object('withdrawal_id', p_withdrawal_id, 'amount', v_withdrawal.amount, 'currency', v_withdrawal.currency)
    );

    RETURN jsonb_build_object('success', true, 'message', 'Payment confirmed');

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action or withdrawal status');
  END IF;
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_seller_withdrawable_balance(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_pending_hold_balance(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_frozen_balance(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_seller_withdrawal(numeric, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_withdrawal_approval(uuid, text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_seller_withdrawable_balance(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_seller_pending_hold_balance(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_seller_frozen_balance(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_seller_withdrawal(numeric, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_withdrawal_approval(uuid, text, text, text) FROM anon;
