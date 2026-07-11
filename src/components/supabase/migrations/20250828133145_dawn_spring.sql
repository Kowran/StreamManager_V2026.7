/*
  # Add foreign key relationships between payment tables and profiles

  1. Foreign Key Constraints
    - Add foreign key from `binance_payments.user_id` to `profiles.id`
    - Add foreign key from `cryptomus_payments.user_id` to `profiles.id`
  
  2. Purpose
    - Enable Supabase to recognize relationships between payment tables and profiles
    - Allow proper JOIN operations in queries
    - Fix AdminPaymentManager profile data loading

  3. Notes
    - Uses IF NOT EXISTS to prevent errors if constraints already exist
    - Maintains referential integrity between tables
*/

-- Add foreign key constraint for binance_payments -> profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'binance_payments_user_id_profiles_fkey'
    AND table_name = 'binance_payments'
  ) THEN
    ALTER TABLE public.binance_payments
    ADD CONSTRAINT binance_payments_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key constraint for cryptomus_payments -> profiles  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'cryptomus_payments_user_id_profiles_fkey'
    AND table_name = 'cryptomus_payments'
  ) THEN
    ALTER TABLE public.cryptomus_payments
    ADD CONSTRAINT cryptomus_payments_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;