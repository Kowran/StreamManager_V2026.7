/*
  # Add expiry date to account profiles

  1. Changes
    - Add `expiry_date` column to `account_profiles` table
    - Allow null values for backward compatibility
    - Add index for performance on expiry date queries

  2. Security
    - No changes to RLS policies needed
*/

-- Add expiry_date column to account_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'account_profiles' AND column_name = 'expiry_date'
  ) THEN
    ALTER TABLE account_profiles ADD COLUMN expiry_date date;
  END IF;
END $$;

-- Add index for performance on expiry date queries
CREATE INDEX IF NOT EXISTS idx_account_profiles_expiry_date 
ON account_profiles(expiry_date) 
WHERE expiry_date IS NOT NULL;