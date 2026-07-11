/*
  # Add foreign key constraints for payment tables

  1. Schema Updates
    - Add foreign key constraint from `binance_payments.user_id` to `profiles.id`
    - Add foreign key constraint from `cryptomus_payments.user_id` to `profiles.id`

  2. Security
    - Maintains existing RLS policies
    - Ensures data integrity between payment and profile tables

  3. Changes
    - Enables proper JOIN operations between payment tables and profiles
    - Allows AdminPaymentManager to fetch user profile data with payments
*/

-- Add foreign key constraint for binance_payments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'binance_payments_user_id_fkey' 
    AND table_name = 'binance_payments'
  ) THEN
    ALTER TABLE public.binance_payments 
    ADD CONSTRAINT binance_payments_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key constraint for cryptomus_payments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'cryptomus_payments_user_id_fkey' 
    AND table_name = 'cryptomus_payments'
  ) THEN
    ALTER TABLE public.cryptomus_payments 
    ADD CONSTRAINT cryptomus_payments_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;