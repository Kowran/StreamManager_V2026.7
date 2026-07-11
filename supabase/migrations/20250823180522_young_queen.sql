/*
  # Add product stock lines table for line-by-line stock management

  1. New Tables
    - `product_stock_lines`
      - `id` (uuid, primary key)
      - `product_id` (uuid, foreign key to store_products)
      - `content` (text, the actual stock line content)
      - `status` (text, available/reserved/sold)
      - `reserved_until` (timestamp, for temporary reservations)
      - `sold_at` (timestamp, when the line was sold)
      - `order_id` (uuid, foreign key to store_orders when sold)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `product_stock_lines` table
    - Add policies for admins to manage all stock lines
    - Add policies for users to view their purchased lines
    - Add policies for authenticated users to add stock lines

  3. Triggers
    - Add trigger to automatically update product stock quantity when stock lines change
*/

-- Create product_stock_lines table
CREATE TABLE IF NOT EXISTS product_stock_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES store_products(id) ON DELETE CASCADE,
  content text NOT NULL,
  status text DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'sold')),
  reserved_until timestamptz,
  sold_at timestamptz,
  order_id uuid REFERENCES store_orders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE product_stock_lines ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all stock lines"
  ON product_stock_lines
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their purchased lines"
  ON product_stock_lines
  FOR SELECT
  TO authenticated
  USING (
    status = 'sold' AND order_id IN (
      SELECT id FROM store_orders WHERE user_id = uid()
    )
  );

CREATE POLICY "Authenticated users can add stock lines"
  ON product_stock_lines
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_stock_lines_product_id ON product_stock_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_lines_status ON product_stock_lines(status);
CREATE INDEX IF NOT EXISTS idx_product_stock_lines_reserved_until ON product_stock_lines(reserved_until) WHERE reserved_until IS NOT NULL;

-- Create function to update product stock quantity
CREATE OR REPLACE FUNCTION update_product_stock_quantity()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the stock_quantity in store_products based on available stock lines
  UPDATE store_products 
  SET stock_quantity = (
    SELECT COUNT(*) 
    FROM product_stock_lines 
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) 
    AND status = 'available'
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_product_stock ON product_stock_lines;
CREATE TRIGGER trigger_update_product_stock
  AFTER INSERT OR UPDATE OR DELETE ON product_stock_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_product_stock_quantity();