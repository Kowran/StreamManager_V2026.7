-- Fix: process_withdrawal_approval called create_notification() with the
-- arguments in the wrong order — the notification title was passed where the
-- notification_type enum belongs, and the type string was passed where the
-- message belongs. This produced the same "function does not exist" signature
-- mismatch error. Correct the argument order and add explicit enum casts.

CREATE OR REPLACE FUNCTION public.process_withdrawal_approval(p_withdrawal_id uuid, p_action text, p_admin_notes text DEFAULT NULL::text, p_payment_proof_url text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
        UPDATE sales_commissions
        SET status = 'paid', withdrawal_id = p_withdrawal_id, updated_at = now()
        WHERE id = v_commission.id;
        v_remaining := v_remaining - v_commission.seller_amount;
      ELSE
        UPDATE sales_commissions
        SET status = 'paid', withdrawal_id = p_withdrawal_id, updated_at = now()
        WHERE id = v_commission.id;
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
