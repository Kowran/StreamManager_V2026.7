/*
  # Create user_purchases table

  1. New Tables
    - `user_purchases`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `order_id` (uuid, foreign key to store_orders)
      - `product_id` (uuid, foreign key to store_products)
      - `product_name` (text)
      - `purchase_price` (numeric)
      - `credentials` (jsonb for storing email, password, instructions)
      - `purchase_date` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `user_purchases` table
    - Add policies for users to read their own purchases
    - Add policies for admins to manage all purchases
    - Add policy for system to insert purchases

  3. Indexes
    - Index on user_id for efficient user queries
    - Index on order_id for order lookups
    - Index on purchase_date for chronological sorting
*/

CREATE TABLE IF NOT EXISTS user_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid,
  product_id uuid,
  product_name text NOT NULL,
  purchase_price numeric(10,2) NOT NULL DEFAULT 0.00,
  credentials jsonb NOT NULL DEFAULT '{}',
  purchase_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_purchases ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_purchases_user_id ON user_purchases (user_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_order_id ON user_purchases (order_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_purchase_date ON user_purchases (purchase_date DESC);

-- RLS Policies
CREATE POLICY "Users can view own purchases"
  ON user_purchases
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all purchases"
  ON user_purchases
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

CREATE POLICY "System can insert purchases"
  ON user_purchases
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Add foreign key constraints
ALTER TABLE user_purchases 
ADD CONSTRAINT user_purchases_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE user_purchases 
ADD CONSTRAINT user_purchases_order_id_fkey 
FOREIGN KEY (order_id) REFERENCES store_orders(id) ON DELETE SET NULL;

ALTER TABLE user_purchases 
ADD CONSTRAINT user_purchases_product_id_fkey 
FOREIGN KEY (product_id) REFERENCES store_products(id) ON DELETE SET NULL;

-- Function to automatically create user_purchases records from deliveries
CREATE OR REPLACE FUNCTION create_user_purchase_from_delivery()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into user_purchases when a delivery is created
  INSERT INTO user_purchases (
    user_id,
    order_id,
    product_id,
    product_name,
    purchase_price,
    credentials,
    purchase_date
  )
  SELECT 
    NEW.user_id,
    NEW.order_id,
    NEW.product_id,
    COALESCE(sp.name, 'Unknown Product'),
    COALESCE(so.total_usdt, 0),
    NEW.delivery_content,
    NEW.delivered_at
  FROM store_orders so
  LEFT JOIN store_products sp ON sp.id = NEW.product_id
  WHERE so.id = NEW.order_id
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically populate user_purchases from deliveries
DROP TRIGGER IF EXISTS trigger_create_user_purchase ON store_deliveries;
CREATE TRIGGER trigger_create_user_purchase
  AFTER INSERT ON store_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION create_user_purchase_from_delivery();

-- Populate existing data from store_deliveries
INSERT INTO user_purchases (
  user_id,
  order_id,
  product_id,
  product_name,
  purchase_price,
  credentials,
  purchase_date
)
SELECT DISTINCT
  sd.user_id,
  sd.order_id,
  sd.product_id,
  COALESCE(sp.name, 'Unknown Product'),
  COALESCE(so.total_usdt, 0),
  sd.delivery_content,
  sd.delivered_at
FROM store_deliveries sd
LEFT JOIN store_orders so ON so.id = sd.order_id
LEFT JOIN store_products sp ON sp.id = sd.product_id
WHERE sd.user_id IS NOT NULL
ON CONFLICT DO NOTHING;