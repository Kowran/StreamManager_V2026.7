/*
  # Fix accounts access profiles relationship

  1. Database Changes
    - Add foreign key constraint from accounts_access_purchases.user_id to profiles.id
    - This enables direct joining between accounts_access_purchases and profiles tables
  
  2. Security
    - No changes to existing RLS policies
    - Maintains current access control patterns
  
  3. Notes
    - This migration enables the AccountsAccessManager component to properly join with profiles
    - Resolves the "Could not find a relationship" error in Supabase queries
*/

-- Add foreign key constraint from accounts_access_purchases to profiles
-- This allows direct joining between the tables
DO $$
BEGIN
  -- Check if the foreign key constraint doesn't already exist
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'accounts_access_purchases_user_id_profiles_fkey'
    AND table_name = 'accounts_access_purchases'
  ) THEN
    -- Add the foreign key constraint
    ALTER TABLE accounts_access_purchases 
    ADD CONSTRAINT accounts_access_purchases_user_id_profiles_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;