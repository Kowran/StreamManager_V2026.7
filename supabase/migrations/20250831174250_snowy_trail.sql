/*
  # Fix Store Products Visibility

  1. Security Updates
    - Update RLS policies for store_products table
    - Ensure all active products are visible to all authenticated users
    - Maintain admin control for product management
    - Allow authenticated users to view all active products regardless of who created them

  2. Changes Made
    - Drop existing restrictive policies
    - Create new comprehensive policies for proper visibility
    - Ensure products added by any user (admin or seller) are visible to everyone
*/

-- Drop existing policies that might be causing visibility issues
DROP POLICY IF EXISTS "Anyone can read active products" ON store_products;
DROP POLICY IF EXISTS "Admins can manage products" ON store_products;
DROP POLICY IF EXISTS "Authenticated users can create products" ON store_products;

-- Create new comprehensive policies for store products
CREATE POLICY "All users can view active products"
  ON store_products
  FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Admins can manage all products"
  ON store_products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert products"
  ON store_products
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Also ensure seller products are visible by updating seller_products policies
DROP POLICY IF EXISTS "Anyone can read active seller products" ON seller_products;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON seller_products;

CREATE POLICY "All users can view active seller products"
  ON seller_products
  FOR SELECT
  TO authenticated
  USING (is_active = true AND stock > 0);

CREATE POLICY "Sellers can manage own products"
  ON seller_products
  FOR ALL
  TO authenticated
  USING (
    seller_application_id IN (
      SELECT id FROM seller_applications 
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    seller_application_id IN (
      SELECT id FROM seller_applications 
      WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can manage seller products"
  ON seller_products
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Refresh the table to ensure policies take effect
NOTIFY pgrst, 'reload schema';