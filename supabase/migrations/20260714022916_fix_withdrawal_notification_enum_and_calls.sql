/*
# Fix withdrawal notification type enum and function calls

## Problem
The `request_seller_withdrawal()` and `process_withdrawal_approval()` functions call
`create_notification()` with arguments in the WRONG ORDER. The `create_notification`
signature is:
  create_notification(p_user_id, p_type notification_type, p_title text, p_message text, ...)

But the withdrawal functions pass:
  create_notification(v_seller_id, 'Saque Solicitado' [title as type], 'Seu pedido...' [message as title], 'withdrawal_requested' [type as message], ...)

This causes: invalid input value for enum notification_type: "Saque Solicitado"

## Changes
1. Add missing enum values to `notification_type`: `withdrawal_requested`,
   `withdrawal_approved`, `withdrawal_rejected`, `withdrawal_paid`.
2. Recreate `request_seller_withdrawal()` with corrected argument order.
3. Recreate `process_withdrawal_approval()` with corrected argument order.
*/
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_requested';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_rejected';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'withdrawal_paid';

-- 2. Recreate request_seller_withdrawal with fixed notification call
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
    v_seller_id,
    'withdrawal_requested'::notification_type,
    'Saque Solicitado',
    'Seu pedido de saque de ' || p_amount || ' ' || p_currency || ' foi criado e está aguardando aprovação do administrador.',
    jsonb_build_object('withdrawal_id', v_withdrawal_id, 'amount', p_amount, 'currency', p_currency)
  );

  RETURN jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id, 'message', 'Withdrawal request created. Awaiting admin approval.');
END;
$function$;

-- 3. Recreate process_withdrawal_approval with fixed notification calls
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
      v_withdrawal.seller_id,
      'withdrawal_approved'::notification_type,
      'Saque Aprovado',
      'Seu pedido de saque de ' || v_withdrawal.amount || ' ' || v_withdrawal.currency || ' foi aprovado. O pagamento está sendo processado.',
      jsonb_build_object('withdrawal_id', p_withdrawal_id, 'amount', v_withdrawal.amount, 'currency', v_withdrawal.currency)
    );

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal approved');

  ELSIF p_action = 'reject' AND v_withdrawal.status IN ('pending', 'approved') THEN
    UPDATE seller_withdrawal_requests
    SET status = 'rejected', rejection_reason = p_admin_notes, processed_at = now(), processed_by = v_admin_id, updated_at = now()
    WHERE id = p_withdrawal_id;

    PERFORM create_notification(
      v_withdrawal.seller_id,
      'withdrawal_rejected'::notification_type,
      'Saque Rejeitado',
      'Seu pedido de saque de ' || v_withdrawal.amount || ' ' || v_withdrawal.currency || ' foi rejeitado. Motivo: ' || COALESCE(p_admin_notes, 'Não especificado'),
      jsonb_build_object('withdrawal_id', p_withdrawal_id, 'amount', v_withdrawal.amount, 'currency', v_withdrawal.currency, 'reason', p_admin_notes)
    );

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal rejected');

  ELSIF p_action = 'confirm_payment' AND v_withdrawal.status = 'approved' THEN
    UPDATE seller_withdrawal_requests
    SET status = 'paid', paid_at = now(), paid_by = v_admin_id, proof_url = p_payment_proof_url, processing_notes = p_admin_notes, updated_at = now()
    WHERE id = p_withdrawal_id;

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
        UPDATE sales_commissions SET status = 'paid', updated_at = now() WHERE id = v_commission.id;
        v_remaining := 0;
      END IF;
    END LOOP;

    PERFORM create_notification(
      v_withdrawal.seller_id,
      'withdrawal_paid'::notification_type,
      'Pagamento Confirmado',
      'Seu saque de ' || v_withdrawal.amount || ' ' || v_withdrawal.currency || ' foi pago.',
      jsonb_build_object('withdrawal_id', p_withdrawal_id, 'amount', v_withdrawal.amount, 'currency', v_withdrawal.currency)
    );

    RETURN jsonb_build_object('success', true, 'message', 'Payment confirmed');

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action or withdrawal status');
  END IF;
END;
$function$;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION public.request_seller_withdrawal(numeric, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_withdrawal_approval(uuid, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.request_seller_withdrawal(numeric, text, jsonb) FROM anon;
