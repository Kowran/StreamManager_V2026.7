
-- Create product variations table
-- Each variation belongs to a product and has its own price and stock
CREATE TABLE IF NOT EXISTS store_product_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  seller_id uuid,
  name text NOT NULL,
  description text,
  price_usdt numeric NOT NULL DEFAULT 0,
  price_brl numeric NOT NULL DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE store_product_variations ENABLE ROW LEVEL SECURITY;

-- Policies: anyone can read active variations; sellers can manage their own
CREATE POLICY "select_product_variations" ON store_product_variations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert_product_variations" ON store_product_variations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "update_product_variations" ON store_product_variations
  FOR UPDATE TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "delete_product_variations" ON store_product_variations
  FOR DELETE TO authenticated USING (auth.uid() = seller_id);

-- Add variation_id to store_orders (nullable, for backward compatibility)
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS variation_id uuid REFERENCES store_product_variations(id) ON DELETE SET NULL;

-- Add variation_id to product_inventory (nullable, so inventory can be linked to a specific variation)
ALTER TABLE product_inventory ADD COLUMN IF NOT EXISTS variation_id uuid REFERENCES store_product_variations(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_variations_product_id ON store_product_variations(product_id);
CREATE INDEX IF NOT EXISTS idx_product_inventory_variation_id ON product_inventory(variation_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_variation_id ON store_orders(variation_id);
