/*
  # Add Cryptomus System Configuration

  1. System Configuration
    - Add system_config table if not exists (already exists)
    - Insert default Cryptomus configuration
    
  2. Security
    - Ensure only admins can access system configurations
    - Add proper RLS policies for system_config table
    
  3. Default Configuration
    - Set Cryptomus as disabled by default
    - Require admin configuration before use
*/

-- Ensure system_config table exists with proper structure
CREATE TABLE IF NOT EXISTS system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on system_config
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can manage system config" ON system_config;

-- Create new admin-only policies
CREATE POLICY "Admins can read system config"
  ON system_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert system config"
  ON system_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update system config"
  ON system_config
  FOR UPDATE
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

CREATE POLICY "Admins can delete system config"
  ON system_config
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Insert default Cryptomus configuration if not exists
INSERT INTO system_config (key, value, description)
VALUES (
  'cryptomus_config',
  '{
    "merchant_id": "",
    "api_key": "",
    "enabled": false,
    "test_mode": true
  }'::jsonb,
  'Configurações da API Cryptomus para pagamentos em criptomoeda'
)
ON CONFLICT (key) DO NOTHING;

-- Insert other default system configurations
INSERT INTO system_config (key, value, description)
VALUES 
  (
    'payment_settings',
    '{
      "min_recharge_amount": 5.00,
      "max_recharge_amount": 1000.00,
      "supported_currencies": ["USD", "BRL"],
      "default_currency": "USD"
    }'::jsonb,
    'Configurações gerais de pagamento'
  ),
  (
    'notification_settings',
    '{
      "email_notifications": true,
      "push_notifications": true,
      "admin_notifications": true,
      "user_notifications": true
    }'::jsonb,
    'Configurações de notificações do sistema'
  )
ON CONFLICT (key) DO NOTHING;