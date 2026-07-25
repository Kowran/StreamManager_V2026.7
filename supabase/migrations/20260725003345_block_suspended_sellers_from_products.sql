/*
# Block suspended sellers from creating/editing products

1. Purpose
   Tightens the existing store_products INSERT, UPDATE, and DELETE policies so a
   seller whose profile has `store_suspended = true` cannot create, edit, or
   delete products. Admins are unaffected. This enforces the store-suspension
   feature at the database level so a suspended seller cannot bypass the UI.

2. Changes
   - Recreates the "Sellers can create products" INSERT policy adding a
     `NOT COALESCE(profiles.store_suspended, false)` guard.
   - Recreates the "Sellers and admins can update products" UPDATE policy with
     the same guard on the seller branch (admins bypass it).
   - Recreates the "Sellers and admins can delete products" DELETE policy with
     the same guard on the seller branch (admins bypass it).

3. Security
   - Existing RLS on store_products stays enabled; only policies are replaced.
   - SELECT policies are untouched — suspended sellers can still see their own
     products, they just can't mutate them.
   - Policies are idempotent (DROP IF EXISTS before CREATE).
*/

-- INSERT: sellers must not be suspended
DROP POLICY IF EXISTS "Sellers can create products" ON store_products;
CREATE POLICY "Sellers can create products"
  ON store_products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'seller')
      AND NOT COALESCE(profiles.store_suspended, false)
    )
    AND (seller_id = auth.uid() OR seller_id IS NULL)
  );

-- UPDATE: sellers must not be suspended (admins bypass)
DROP POLICY IF EXISTS "Sellers and admins can update products" ON store_products;
CREATE POLICY "Sellers and admins can update products"
  ON store_products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'admin'
        OR (profiles.role = 'seller'
            AND store_products.seller_id = auth.uid()
            AND NOT COALESCE(profiles.store_suspended, false))
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'admin'
        OR (profiles.role = 'seller'
            AND seller_id = auth.uid()
            AND NOT COALESCE(profiles.store_suspended, false))
      )
    )
  );

-- DELETE: sellers must not be suspended (admins bypass)
DROP POLICY IF EXISTS "Sellers and admins can delete products" ON store_products;
CREATE POLICY "Sellers and admins can delete products"
  ON store_products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'admin'
        OR (profiles.role = 'seller'
            AND store_products.seller_id = auth.uid()
            AND NOT COALESCE(profiles.store_suspended, false))
      )
    )
  );
