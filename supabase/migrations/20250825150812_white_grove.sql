/*
  # Create product_inventory table for managing store product stock

  1. New Tables
    - `product_inventory`
      - `id` (uuid, primary key)
      - `product_id` (uuid, foreign key to store_products)
      - `email` (text, account email)
      - `password` (text, account password)
      - `instructions` (text, delivery instructions)
      - `status` (text, availability status)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `product_inventory` table
    - Add policies for admins to manage inventory
    - Add policies for authenticated users to view available inventory

  3. Triggers
    - Auto-update `store_products.stock_quantity` when inventory changes
    - Auto-update `updated_at` timestamp on changes

  4. Indexes
    - Index on product_id for efficient queries
    - Index on status for filtering available items
*/

-- Create product_inventory table
CREATE TABLE IF NOT EXISTS product_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  email text NOT NULL,
  password text NOT NULL,
  instructions text DEFAULT 'Use estas credenciais para acessar sua conta.',
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT product_inventory_status_check 
    CHECK (status IN ('available', 'sold', 'reserved'))
);

-- Enable RLS
ALTER TABLE product_inventory ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_inventory_product_id 
  ON product_inventory(product_id);

CREATE INDEX IF NOT EXISTS idx_product_inventory_status 
  ON product_inventory(status);

CREATE INDEX IF NOT EXISTS idx_product_inventory_created_at 
  ON product_inventory(created_at DESC);

-- RLS Policies
CREATE POLICY "Admins can manage all inventory"
  ON product_inventory
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

CREATE POLICY "Users can view available inventory"
  ON product_inventory
  FOR SELECT
  TO authenticated
  USING (status = 'available');

-- Function to update store_products stock_quantity
CREATE OR REPLACE FUNCTION update_store_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the stock_quantity in store_products based on available inventory
  UPDATE store_products 
  SET 
    stock_quantity = (
      SELECT COUNT(*) 
      FROM product_inventory 
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
      AND status = 'available'
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update stock quantity
CREATE TRIGGER trigger_update_store_product_stock
  AFTER INSERT OR UPDATE OR DELETE ON product_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_store_product_stock();

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_product_inventory_updated_at
  BEFORE UPDATE ON product_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();