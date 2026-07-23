/*
# Fix Binance Pay status check constraint

1. Problem
   - The `complete_binance_payment` RPC (and the unique partial index
     `binance_payments_completed_tx_id_unique`) use the status value
     `'completed'` to mark a verified payment.
   - However the original check constraint
     `binance_payments_status_check` (created in the initial table migration)
     only allows: 'pending', 'paid', 'expired', 'cancelled', 'failed'.
   - As a result, the RPC's `UPDATE ... SET status = 'completed'` is rejected
     with: "new row for relation binance_payments violates check constraint
     binance_payments_status_check", so verified payments never complete.

2. Changes
   - Drop the existing `binance_payments_status_check` constraint.
   - Recreate it with the same allowed values PLUS `'completed'`, which is the
     canonical "payment verified and credited" state used across the codebase
     (RPC, unique index, and the create-binance-payment / check-binance-payment
     edge functions).

3. Security
   - No RLS or policy changes.
   - No data is modified or deleted — only the CHECK constraint definition.
*/

ALTER TABLE binance_payments
  DROP CONSTRAINT IF EXISTS binance_payments_status_check;

ALTER TABLE binance_payments
  ADD CONSTRAINT binance_payments_status_check
  CHECK (status IN ('pending', 'paid', 'expired', 'cancelled', 'failed', 'completed'));
