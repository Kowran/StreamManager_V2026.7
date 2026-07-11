/*
  # Fix Product Inventory RLS Policies for Sellers

  ## Summary
  This migration adds RLS policies to allow sellers to manage inventory for their own products.

  ## Changes Made

  ### New Policies
  1. **"Sellers can insert inventory for own products"**
     - Allows sellers to insert inventory items for products they own
     - Checks that the product belongs to the seller via `store_products.seller_id`

  2. **"Sellers can update own product inventory"**
     - Allows sellers to update inventory items for their own products
     - Only allows updating items with 'available' status
     - Verifies ownership through `store_products.seller_id`

  3. **"Sellers can delete own product inventory"**
     - Allows sellers to delete inventory items for their own products
     - Only allows deleting items with 'available' status
     - Verifies ownership through `store_products.seller_id`

  4. **"Sellers can view own product inventory"**
     - Allows sellers to view all inventory items for their own products
     - Verifies ownership through `store_products.seller_id`

  ## Security Notes
  - Sellers can only manage inventory for products they own
  - Sellers cannot modify sold or reserved inventory items
  - Admin policies remain unchanged and take precedence
*/

-- Policy for sellers to insert inventory for their own products
CREATE POLICY "Sellers can insert inventory for own products"
  ON product_inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM store_products
      WHERE store_products.id = product_inventory.product_id
      AND store_products.seller_id = auth.uid()
    )
  );

-- Policy for sellers to update inventory for their own products
CREATE POLICY "Sellers can update own product inventory"
  ON product_inventory
  FOR UPDATE
  TO authenticated
  USING (
    status = 'available' AND
    EXISTS (
      SELECT 1 FROM store_products
      WHERE store_products.id = product_inventory.product_id
      AND store_products.seller_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'available' AND
    EXISTS (
      SELECT 1 FROM store_products
      WHERE store_products.id = product_inventory.product_id
      AND store_products.seller_id = auth.uid()
    )
  );

-- Policy for sellers to delete inventory for their own products
CREATE POLICY "Sellers can delete own product inventory"
  ON product_inventory
  FOR DELETE
  TO authenticated
  USING (
    status = 'available' AND
    EXISTS (
      SELECT 1 FROM store_products
      WHERE store_products.id = product_inventory.product_id
      AND store_products.seller_id = auth.uid()
    )
  );

-- Policy for sellers to view inventory for their own products
CREATE POLICY "Sellers can view own product inventory"
  ON product_inventory
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM store_products
      WHERE store_products.id = product_inventory.product_id
      AND store_products.seller_id = auth.uid()
    )
  );
