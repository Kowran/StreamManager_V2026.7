/*
  # Fix Seller Requests Foreign Key Relationship

  1. Changes
    - Add foreign key constraint from seller_requests.user_id to profiles.id
    - This enables Supabase to automatically resolve the relationship for queries
    
  2. Important Notes
    - The foreign key references profiles instead of auth.users
    - This allows the JOIN in queries like: seller_requests -> profiles(full_name, email)
    - Existing data is preserved
*/

-- Add foreign key constraint from seller_requests to profiles
-- First check if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'seller_requests_user_id_fkey_profiles' 
    AND table_name = 'seller_requests'
  ) THEN
    ALTER TABLE seller_requests 
    ADD CONSTRAINT seller_requests_user_id_fkey_profiles 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_seller_requests_user_id ON seller_requests(user_id);
