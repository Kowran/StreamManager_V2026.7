/*
  # Create seller system tables

  1. New Tables
    - `seller_applications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `business_name` (text)
      - `business_description` (text)
      - `contact_email` (text)
      - `contact_phone` (text)
      - `business_type` (text)
      - `experience_years` (integer)
      - `portfolio_url` (text, optional)
      - `status` (enum: pending, approved, rejected)
      - `rejection_reason` (text, optional)
      - `applied_at` (timestamp)
      - `reviewed_at` (timestamp, optional)
      - `reviewed_by` (uuid, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `seller_sales`
      - `id` (uuid, primary key)
      - `seller_id` (uuid, foreign key to seller_applications)
      - `product_id` (uuid, foreign key to seller_products)
      - `buyer_id` (uuid, foreign key to auth.users)
      - `order_id` (uuid, foreign key to store_orders)
      - `amount` (numeric)
      - `admin_commission` (numeric)
      - `seller_commission` (numeric)
      - `commission_rate` (numeric)
      - `status` (text)
      - `sale_date` (timestamp)
      - `commission_paid` (boolean)
      - `commission_paid_at` (timestamp, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Updates
    - Add foreign key relationship from `seller_products` to `seller_applications`
    - Update existing seller_products to reference seller_applications instead of sellers

  3. Security
    - Enable RLS on new tables
    - Add appropriate policies for sellers and admins
*/

-- Create seller_applications table
CREATE TABLE IF NOT EXISTS seller_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  business_description text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  business_type text NOT NULL DEFAULT 'individual',
  experience_years integer NOT NULL DEFAULT 0,
  portfolio_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  applied_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create seller_sales table
CREATE TABLE IF NOT EXISTS seller_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES seller_applications(id) ON DELETE CASCADE,
  product_id uuid REFERENCES seller_products(id) ON DELETE SET NULL,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES store_orders(id) ON DELETE SET NULL,
  total_amount numeric(10,2) NOT NULL DEFAULT 0.00,
  admin_commission numeric(10,2) NOT NULL DEFAULT 0.00,
  seller_commission numeric(10,2) NOT NULL DEFAULT 0.00,
  commission_rate numeric(5,4) NOT NULL DEFAULT 0.04,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
  sale_date timestamptz NOT NULL DEFAULT now(),
  commission_paid boolean NOT NULL DEFAULT false,
  commission_paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add seller_application_id to seller_products if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'seller_products' AND column_name = 'seller_application_id'
  ) THEN
    ALTER TABLE seller_products ADD COLUMN seller_application_id uuid REFERENCES seller_applications(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE seller_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_sales ENABLE ROW LEVEL SECURITY;

-- Policies for seller_applications
CREATE POLICY "Users can create own applications"
  ON seller_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own applications"
  ON seller_applications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own pending applications"
  ON seller_applications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all applications"
  ON seller_applications
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Policies for seller_sales
CREATE POLICY "Sellers can view own sales"
  ON seller_sales
  FOR SELECT
  TO authenticated
  USING (seller_id IN (
    SELECT id FROM seller_applications WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all sales"
  ON seller_sales
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "System can create sales"
  ON seller_sales
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_seller_applications_user_id ON seller_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_applications_status ON seller_applications(status);
CREATE INDEX IF NOT EXISTS idx_seller_applications_applied_at ON seller_applications(applied_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_sales_seller_id ON seller_sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_sales_buyer_id ON seller_sales(buyer_id);
CREATE INDEX IF NOT EXISTS idx_seller_sales_sale_date ON seller_sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_seller_sales_status ON seller_sales(status);

-- Create functions for seller management
CREATE OR REPLACE FUNCTION approve_seller_application(
  application_id uuid,
  admin_id uuid
) RETURNS boolean AS $$
BEGIN
  UPDATE seller_applications
  SET 
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = admin_id,
    updated_at = now()
  WHERE id = application_id AND status = 'pending';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_seller_application(
  application_id uuid,
  admin_id uuid,
  rejection_reason text
) RETURNS boolean AS $$
BEGIN
  UPDATE seller_applications
  SET 
    status = 'rejected',
    rejection_reason = rejection_reason,
    reviewed_at = now(),
    reviewed_by = admin_id,
    updated_at = now()
  WHERE id = application_id AND status = 'pending';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;