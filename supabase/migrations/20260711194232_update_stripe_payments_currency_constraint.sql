-- Expand currency constraint on stripe_payments to support all user currencies
ALTER TABLE stripe_payments
  DROP CONSTRAINT IF EXISTS stripe_payments_currency_check;

ALTER TABLE stripe_payments
  ADD CONSTRAINT stripe_payments_currency_check
  CHECK (currency IN ('USD', 'EUR', 'GBP', 'BRL', 'ARS', 'COP', 'CLP', 'PEN', 'MXN', 'VES'));
