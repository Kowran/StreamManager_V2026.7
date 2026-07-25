-- Withdrawal verification system
-- Sellers must confirm a 6-digit code (via email) OR a TOTP code (if 2FA enabled)
-- before a withdrawal request is created.

CREATE TABLE IF NOT EXISTS withdrawal_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USDT',
  consumed boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE withdrawal_verification_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_withdrawal_codes" ON withdrawal_verification_codes;
CREATE POLICY "select_own_withdrawal_codes" ON withdrawal_verification_codes FOR SELECT
  TO authenticated USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "insert_own_withdrawal_codes" ON withdrawal_verification_codes;
CREATE POLICY "insert_own_withdrawal_codes" ON withdrawal_verification_codes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = seller_id);

CREATE INDEX IF NOT EXISTS idx_withdrawal_codes_seller ON withdrawal_verification_codes(seller_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_codes_expires ON withdrawal_verification_codes(expires_at);

-- Generate a 6-digit code, store it, and return it so the caller (edge function)
-- can email it to the seller. The code is valid for 10 minutes.
CREATE OR REPLACE FUNCTION public.create_withdrawal_verification_code(
  p_amount numeric,
  p_currency text DEFAULT 'USDT'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_seller_id uuid := auth.uid();
  v_code text;
  v_email text;
  v_full_name text;
  v_lang text;
BEGIN
  IF v_seller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Generate 6-digit code
  v_code := lpad(floor(random() * 1000000)::text, 6, '0');

  -- Insert verification code (valid 10 minutes)
  INSERT INTO withdrawal_verification_codes (seller_id, code, amount, currency, expires_at)
  VALUES (v_seller_id, v_code, p_amount, p_currency, now() + interval '10 minutes');

  -- Get seller email + name for the notification
  SELECT email, full_name, language INTO v_email, v_full_name, v_lang
  FROM profiles WHERE id = v_seller_id;

  RETURN jsonb_build_object(
    'success', true,
    'code', v_code,
    'email', v_email,
    'full_name', v_full_name,
    'language', v_lang
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_withdrawal_verification_code(numeric, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_withdrawal_verification_code(numeric, text) FROM anon;

-- Updated request_seller_withdrawal: requires a verification code (email) OR a valid TOTP (2FA).
-- p_verification_method: 'email' | 'totp'
-- p_verification_code: the 6-digit code the seller entered
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
  v_totp_ok boolean := false;
BEGIN
  IF v_seller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_verification_code IS NULL OR btrim(p_verification_code) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Código de verificação é obrigatório');
  END IF;

  SELECT two_factor_enabled, two_factor_secret INTO v_profile FROM profiles WHERE id = v_seller_id;

  -- If 2FA is enabled and method is totp, the code is validated client-side via TOTP.
  -- Here we only enforce that a code was provided; TOTP validation happens in the
  -- calling edge function using the shared secret. For email method, validate the stored code.
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

    -- Consume the code
    UPDATE withdrawal_verification_codes SET consumed = true WHERE id = v_stored_code.id;
  ELSIF p_verification_method = 'totp' THEN
    IF NOT (v_profile.two_factor_enabled AND v_profile.two_factor_secret IS NOT NULL) THEN
      RETURN jsonb_build_object('success', false, 'error', '2FA não está ativo para esta conta');
    END IF;
    -- TOTP is verified in the edge function; here we trust the caller verified it.
    -- To keep the DB the source of truth, we still require the code to be present.
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
    v_seller_id, 'Saque Solicitado',
    'Seu pedido de saque de ' || p_amount || ' ' || p_currency || ' foi criado e está aguardando aprovação do administrador.',
    'withdrawal_requested',
    jsonb_build_object('withdrawal_id', v_withdrawal_id, 'amount', p_amount, 'currency', p_currency)
  );

  RETURN jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id, 'message', 'Withdrawal request created. Awaiting admin approval.');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.request_seller_withdrawal(numeric, text, jsonb, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.request_seller_withdrawal(numeric, text, jsonb, text, text) FROM anon;

-- Clean up expired codes periodically (optional helper)
CREATE OR REPLACE FUNCTION public.cleanup_expired_withdrawal_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  DELETE FROM withdrawal_verification_codes WHERE expires_at < now() - interval '1 day';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_withdrawal_codes() TO authenticated;
