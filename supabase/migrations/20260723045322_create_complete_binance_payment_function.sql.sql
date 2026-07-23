-- Atomic completion function for Binance Pay payments.
-- Returns true if this call completed the payment, false if the Order ID was
-- already used by another completed payment or this record was already
-- completed (race-safe without relying on client-side .select() behaviour).
CREATE OR REPLACE FUNCTION public.complete_binance_payment(
  p_payment_id uuid,
  p_tx_id text,
  p_webhook_data jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  already_used int;
  rows_updated int;
BEGIN
  SELECT count(*) INTO already_used
  FROM binance_payments
  WHERE tx_id = p_tx_id AND status = 'completed' AND id <> p_payment_id;

  IF already_used > 0 THEN
    RETURN false;
  END IF;

  UPDATE binance_payments
  SET status       = 'completed',
      tx_id        = p_tx_id,
      paid_at      = now(),
      updated_at   = now(),
      webhook_data = p_webhook_data
  WHERE id = p_payment_id AND status = 'pending';

  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  RETURN rows_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_binance_payment(uuid, text, jsonb) TO authenticated;
