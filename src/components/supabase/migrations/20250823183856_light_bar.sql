/*
  # Add user_id column to store_deliveries table

  1. Schema Changes
    - Add `user_id` column to `store_deliveries` table
    - Set up foreign key relationship with auth.users
    - Add index for performance
  
  2. Security
    - Update RLS policies to use user_id for better security
    - Ensure users can only access their own deliveries
*/

-- Add user_id column to store_deliveries table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_deliveries' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE store_deliveries ADD COLUMN user_id uuid;
  END IF;
END $$;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'store_deliveries_user_id_fkey'
  ) THEN
    ALTER TABLE store_deliveries 
    ADD CONSTRAINT store_deliveries_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_store_deliveries_user_id 
ON store_deliveries(user_id);

-- Update existing deliveries to set user_id from orders
UPDATE store_deliveries 
SET user_id = store_orders.user_id
FROM store_orders
WHERE store_deliveries.order_id = store_orders.id
AND store_deliveries.user_id IS NULL;

-- Update RLS policies
DROP POLICY IF EXISTS "Users can view own deliveries" ON store_deliveries;
DROP POLICY IF EXISTS "Admins can manage deliveries" ON store_deliveries;

-- Create new RLS policies
CREATE POLICY "Users can view own deliveries"
  ON store_deliveries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage deliveries"
  ON store_deliveries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert deliveries"
  ON store_deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());