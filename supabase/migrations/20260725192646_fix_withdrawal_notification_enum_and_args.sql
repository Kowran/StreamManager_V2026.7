-- Fix 1: Correct create_notification argument order in request_seller_withdrawal.
-- The function signature is (p_user_id, p_type notification_type, p_title, p_message, p_data).
-- Previously the title was passed as p_type, causing enum cast error.

CREATE OR REPLACE FUNCTION public.request_seller_withdrawal(
  p_amount numeric,
  p_currency text DEFAULT 'USDT',
  p_payment_method jsonb DEFAULT '{}'::jsonb,
  p_verification_method text DEFAULT 'email',
  p_verification_code text DEFAULT NULL
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
  v_profile RECORD;
  v_stored_code RECORD;
BEGIN
  IF v_seller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_verification_code IS NULL OR btrim(p_verification_code) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código de verificação é obrigatório');
  END IF;

  SELECT two_factor_enabled, two_factor_secret INTO v_profile FROM profiles WHERE id = v_seller_id;

  IF p_verification_method = 'email' THEN
    SELECT * INTO v_stored_code
    FROM withdrawal_verification_codes
    WHERE seller_id = v_seller_id
      AND code = btrim(p_verification_code)
      AND consumed = false
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Código de verificação inválido ou expirado');
    END IF;

    UPDATE withdrawal_verification_codes SET consumed = true WHERE id = v_stored_code.id;
  ELSIF p_verification_method = 'totp' THEN
    IF NOT (v_profile.two_factor_enabled AND v_profile.two_factor_secret IS NOT NULL) THEN
      RETURN jsonb_build_object('success', false, 'error', '2FA não está ativo para esta conta');
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Método de verificação inválido');
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

GRANT EXECUTE ON FUNCTION public.request_seller_withdrawal(numeric, text, jsonb, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.request_seller_withdrawal(numeric, text, jsonb, text, text) FROM anon;
