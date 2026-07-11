/*
  # Create seller product inventory table

  1. New Tables
    - `seller_product_inventory`
      - `id` (uuid, primary key)
      - `seller_product_id` (uuid, foreign key to seller_products)
      - `email` (text, account email)
      - `password` (text, account password)
      - `instructions` (text, delivery instructions)
      - `status` (text, available/reserved/sold)
      - `reserved_until` (timestamp, reservation expiry)
      - `sold_at` (timestamp, when item was sold)
      - `order_id` (uuid, reference to order when sold)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `seller_product_inventory` table
    - Add policies for sellers to manage their own inventory
    - Add policies for admins to manage all inventory

  3. Indexes
    - Index on seller_product_id for fast lookups
    - Index on status for filtering
    - Index on reserved_until for cleanup operations
*/

CREATE TABLE IF NOT EXISTS seller_product_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_product_id uuid NOT NULL REFERENCES seller_products(id) ON DELETE CASCADE,
  email text NOT NULL,
  password text NOT NULL,
  instructions text DEFAULT 'Use estas credenciais para acessar sua conta.',
  status text DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'sold')),
  reserved_until timestamptz,
  sold_at timestamptz,
  order_id uuid REFERENCES store_orders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_seller_product_inventory_seller_product_id 
  ON seller_product_inventory(seller_product_id);

CREATE INDEX IF NOT EXISTS idx_seller_product_inventory_status 
  ON seller_product_inventory(status);

CREATE INDEX IF NOT EXISTS idx_seller_product_inventory_reserved_until 
  ON seller_product_inventory(reserved_until) 
  WHERE reserved_until IS NOT NULL;

-- Enable RLS
ALTER TABLE seller_product_inventory ENABLE ROW LEVEL SECURITY;

-- Policies for sellers to manage their own inventory
CREATE POLICY "Sellers can manage own product inventory"
  ON seller_product_inventory
  FOR ALL
  TO authenticated
  USING (
    seller_product_id IN (
      SELECT id FROM seller_products 
      WHERE seller_application_id IN (
        SELECT id FROM seller_applications 
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    seller_product_id IN (
      SELECT id FROM seller_products 
      WHERE seller_application_id IN (
        SELECT id FROM seller_applications 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Policy for admins to manage all inventory
CREATE POLICY "Admins can manage all seller inventory"
  ON seller_product_inventory
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Function to update seller product stock count
CREATE OR REPLACE FUNCTION update_seller_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Update stock count for the affected seller product
  UPDATE seller_products 
  SET stock = (
    SELECT COUNT(*) 
    FROM seller_product_inventory 
    WHERE seller_product_id = COALESCE(NEW.seller_product_id, OLD.seller_product_id)
    AND status = 'available'
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.seller_product_id, OLD.seller_product_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update stock count
CREATE TRIGGER trigger_update_seller_product_stock
  AFTER INSERT OR UPDATE OR DELETE ON seller_product_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_product_stock();