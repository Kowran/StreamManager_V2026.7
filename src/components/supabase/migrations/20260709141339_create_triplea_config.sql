-- Triple-A Payment Gateway Configuration Table
CREATE TABLE IF NOT EXISTS triplea_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  merchant_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sandbox_mode BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Triple-A Payment Transactions
CREATE TABLE IF NOT EXISTS triplea_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  external_id TEXT,
  order_id TEXT NOT NULL UNIQUE,
  payment_url TEXT,
  status TEXT DEFAULT 'pending',
  access_token TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE triplea_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE triplea_payments ENABLE ROW LEVEL SECURITY;

-- Triple-A Config Policies (admin only)
CREATE POLICY "admin_select_triplea_config" ON triplea_config
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "admin_insert_triplea_config" ON triplea_config
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "admin_update_triplea_config" ON triplea_config
  FOR UPDATE TO authenticated
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

-- Triple-A Payments Policies
CREATE POLICY "user_select_own_triplea_payments" ON triplea_payments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin_select_all_triplea_payments" ON triplea_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "user_insert_triplea_payments" ON triplea_payments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service_update_triplea_payments" ON triplea_payments
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_triplea_payments_user_id ON triplea_payments(user_id);
CREATE INDEX idx_triplea_payments_order_id ON triplea_payments(order_id);
CREATE INDEX idx_triplea_payments_status ON triplea_payments(status);

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_triplea_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER triplea_config_updated_at
  BEFORE UPDATE ON triplea_config
  FOR EACH ROW
  EXECUTE FUNCTION update_triplea_updated_at();

CREATE TRIGGER triplea_payments_updated_at
  BEFORE UPDATE ON triplea_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_triplea_updated_at();