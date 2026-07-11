/*
  # Update PayPal for International Support

  1. Database Changes
    - Update paypal_payments table to support international currencies
    - Add exchange rate tracking
    - Add country and locale information
    - Update currency constraints to support more currencies

  2. Security
    - Maintain existing RLS policies
    - Add validation for international payments
*/

-- Update paypal_payments table to support international currencies
DO $$
BEGIN
  -- Add new columns for international support
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paypal_payments' AND column_name = 'exchange_rate'
  ) THEN
    ALTER TABLE paypal_payments ADD COLUMN exchange_rate numeric(10,6) DEFAULT 1.0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paypal_payments' AND column_name = 'user_country'
  ) THEN
    ALTER TABLE paypal_payments ADD COLUMN user_country text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paypal_payments' AND column_name = 'user_locale'
  ) THEN
    ALTER TABLE paypal_payments ADD COLUMN user_locale text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paypal_payments' AND column_name = 'international_payment'
  ) THEN
    ALTER TABLE paypal_payments ADD COLUMN international_payment boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paypal_payments' AND column_name = 'original_currency'
  ) THEN
    ALTER TABLE paypal_payments ADD COLUMN original_currency text DEFAULT 'USD';
  END IF;
END $$;

-- Update currency constraint to support international currencies
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'paypal_payments' AND constraint_name = 'paypal_payments_currency_check'
  ) THEN
    ALTER TABLE paypal_payments DROP CONSTRAINT paypal_payments_currency_check;
  END IF;

  -- Add new constraint with international currencies
  ALTER TABLE paypal_payments ADD CONSTRAINT paypal_payments_currency_check 
    CHECK ((currency = ANY (ARRAY[
      'USD'::text, 'EUR'::text, 'GBP'::text, 'CAD'::text, 'AUD'::text, 'BRL'::text,
      'MXN'::text, 'ARS'::text, 'CLP'::text, 'COP'::text, 'PEN'::text, 'JPY'::text,
      'KRW'::text, 'CNY'::text, 'INR'::text, 'SGD'::text, 'HKD'::text, 'THB'::text,
      'MYR'::text, 'PHP'::text, 'RUB'::text, 'TRY'::text, 'ZAR'::text, 'CHF'::text,
      'SEK'::text, 'NOK'::text, 'DKK'::text, 'PLN'::text, 'CZK'::text, 'HUF'::text,
      'ILS'::text, 'TWD'::text, 'NZD'::text
    ])));
END $$;

-- Create index for international payment queries
CREATE INDEX IF NOT EXISTS idx_paypal_payments_international 
  ON paypal_payments (international_payment, currency) 
  WHERE international_payment = true;

-- Create index for country-based analytics
CREATE INDEX IF NOT EXISTS idx_paypal_payments_country 
  ON paypal_payments (user_country) 
  WHERE user_country IS NOT NULL;

-- Update system config to include supported currencies
INSERT INTO system_config (key, value, description, created_at, updated_at)
VALUES (
  'paypal_supported_currencies',
  '{
    "currencies": [
      {"code": "USD", "name": "US Dollar", "symbol": "$", "flag": "🇺🇸"},
      {"code": "EUR", "name": "Euro", "symbol": "€", "flag": "🇪🇺"},
      {"code": "GBP", "name": "British Pound", "symbol": "£", "flag": "🇬🇧"},
      {"code": "CAD", "name": "Canadian Dollar", "symbol": "C$", "flag": "🇨🇦"},
      {"code": "AUD", "name": "Australian Dollar", "symbol": "A$", "flag": "🇦🇺"},
      {"code": "BRL", "name": "Brazilian Real", "symbol": "R$", "flag": "🇧🇷"},
      {"code": "MXN", "name": "Mexican Peso", "symbol": "$", "flag": "🇲🇽"},
      {"code": "ARS", "name": "Argentine Peso", "symbol": "$", "flag": "🇦🇷"},
      {"code": "CLP", "name": "Chilean Peso", "symbol": "$", "flag": "🇨🇱"},
      {"code": "COP", "name": "Colombian Peso", "symbol": "$", "flag": "🇨🇴"},
      {"code": "PEN", "name": "Peruvian Sol", "symbol": "S/", "flag": "🇵🇪"},
      {"code": "JPY", "name": "Japanese Yen", "symbol": "¥", "flag": "🇯🇵"},
      {"code": "KRW", "name": "South Korean Won", "symbol": "₩", "flag": "🇰🇷"},
      {"code": "CNY", "name": "Chinese Yuan", "symbol": "¥", "flag": "🇨🇳"},
      {"code": "INR", "name": "Indian Rupee", "symbol": "₹", "flag": "🇮🇳"},
      {"code": "SGD", "name": "Singapore Dollar", "symbol": "S$", "flag": "🇸🇬"},
      {"code": "HKD", "name": "Hong Kong Dollar", "symbol": "HK$", "flag": "🇭🇰"},
      {"code": "THB", "name": "Thai Baht", "symbol": "฿", "flag": "🇹🇭"},
      {"code": "MYR", "name": "Malaysian Ringgit", "symbol": "RM", "flag": "🇲🇾"},
      {"code": "PHP", "name": "Philippine Peso", "symbol": "₱", "flag": "🇵🇭"},
      {"code": "RUB", "name": "Russian Ruble", "symbol": "₽", "flag": "🇷🇺"},
      {"code": "TRY", "name": "Turkish Lira", "symbol": "₺", "flag": "🇹🇷"},
      {"code": "ZAR", "name": "South African Rand", "symbol": "R", "flag": "🇿🇦"},
      {"code": "CHF", "name": "Swiss Franc", "symbol": "CHF", "flag": "🇨🇭"},
      {"code": "SEK", "name": "Swedish Krona", "symbol": "kr", "flag": "🇸🇪"},
      {"code": "NOK", "name": "Norwegian Krone", "symbol": "kr", "flag": "🇳🇴"},
      {"code": "DKK", "name": "Danish Krone", "symbol": "kr", "flag": "🇩🇰"},
      {"code": "PLN", "name": "Polish Zloty", "symbol": "zł", "flag": "🇵🇱"},
      {"code": "CZK", "name": "Czech Koruna", "symbol": "Kč", "flag": "🇨🇿"},
      {"code": "HUF", "name": "Hungarian Forint", "symbol": "Ft", "flag": "🇭🇺"},
      {"code": "ILS", "name": "Israeli Shekel", "symbol": "₪", "flag": "🇮🇱"},
      {"code": "TWD", "name": "Taiwan Dollar", "symbol": "NT$", "flag": "🇹🇼"},
      {"code": "NZD", "name": "New Zealand Dollar", "symbol": "NZ$", "flag": "🇳🇿"}
    ],
    "default_currency": "USD",
    "international_enabled": true
  }',
  'Lista de moedas suportadas pelo PayPal para pagamentos internacionais',
  now(),
  now()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- Create function to get currency exchange rate
CREATE OR REPLACE FUNCTION get_currency_exchange_rate(
  from_currency text,
  to_currency text DEFAULT 'USD'
)
RETURNS numeric AS $$
DECLARE
  exchange_rates jsonb;
  rate numeric;
BEGIN
  -- Get exchange rates from system config
  SELECT value->'exchange_rates' INTO exchange_rates
  FROM system_config
  WHERE key = 'currency_exchange_rates';
  
  -- If no rates configured, return 1.0
  IF exchange_rates IS NULL THEN
    RETURN 1.0;
  END IF;
  
  -- Get the rate for the currency
  rate := (exchange_rates->>from_currency)::numeric;
  
  -- Return rate or 1.0 if not found
  RETURN COALESCE(rate, 1.0);
END;
$$ LANGUAGE plpgsql;

-- Insert default exchange rates
INSERT INTO system_config (key, value, description, created_at, updated_at)
VALUES (
  'currency_exchange_rates',
  '{
    "exchange_rates": {
      "USD": 1.0,
      "EUR": 0.85,
      "GBP": 0.73,
      "CAD": 1.25,
      "AUD": 1.35,
      "JPY": 110.0,
      "BRL": 5.5,
      "MXN": 20.0,
      "ARS": 350.0,
      "CLP": 800.0,
      "COP": 4000.0,
      "PEN": 3.8,
      "SGD": 1.35,
      "HKD": 7.8,
      "INR": 75.0,
      "KRW": 1200.0,
      "CNY": 6.5,
      "RUB": 75.0,
      "TRY": 15.0,
      "ZAR": 15.0,
      "CHF": 0.92,
      "SEK": 9.0,
      "NOK": 8.5,
      "DKK": 6.3,
      "PLN": 3.9,
      "CZK": 22.0,
      "HUF": 300.0,
      "ILS": 3.2,
      "TWD": 28.0,
      "THB": 33.0,
      "MYR": 4.2,
      "PHP": 50.0,
      "NZD": 1.45
    },
    "last_updated": "2025-01-24T00:00:00Z",
    "source": "manual_configuration"
  }',
  'Taxas de câmbio para conversão de moedas internacionais',
  now(),
  now()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();