-- Enforce that a Binance Pay Order ID (tx_id) can only ever credit one row.
-- Partial unique index scoped to completed payments, so pending rows with
-- NULL/duplicate tx_id values don't interfere, but once a payment is marked
-- completed its Order ID can never be reused for a second completed deposit.
CREATE UNIQUE INDEX IF NOT EXISTS binance_payments_completed_tx_id_unique
  ON binance_payments (tx_id)
  WHERE status = 'completed' AND tx_id IS NOT NULL;
