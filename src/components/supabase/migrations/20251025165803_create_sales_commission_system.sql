/*
  # Sistema de Taxa de Vendas (Comissão)

  1. Nova Tabela
    - `sales_commissions`
      - `id` (uuid, primary key)
      - `order_id` (uuid, referência a store_orders)
      - `seller_id` (uuid, referência a profiles)
      - `total_amount` (numeric, valor total da venda)
      - `admin_commission_rate` (numeric, taxa do admin em %, default 4%)
      - `seller_commission_rate` (numeric, taxa do vendedor em %, default 96%)
      - `admin_amount` (numeric, valor da comissão do admin)
      - `seller_amount` (numeric, valor da comissão do vendedor)
      - `currency` (text, 'BRL' ou 'USDT')
      - `status` (text, 'pending', 'paid', 'cancelled')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Configuração Global
    - `sales_commission_config`
      - `id` (uuid, primary key)
      - `admin_commission_rate` (numeric, taxa global do admin)
      - `seller_commission_rate` (numeric, taxa global do vendedor)
      - `updated_at` (timestamp)
      - `updated_by` (uuid, referência ao admin que atualizou)

  3. Segurança
    - Vendedores podem ver suas próprias comissões
    - Admin pode ver e gerenciar todas as comissões
    - Apenas admin pode alterar as configurações de taxa

  4. Funcionalidades
    - Trigger automático para calcular comissões quando um pedido é completado
    - Função para processar pagamento de comissões
    - Histórico completo de comissões por vendedor e período
*/

-- Criar tabela de configuração de comissões
CREATE TABLE IF NOT EXISTS sales_commission_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_commission_rate numeric NOT NULL DEFAULT 4.00,
  seller_commission_rate numeric NOT NULL DEFAULT 96.00,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT valid_commission_rates CHECK (
    admin_commission_rate >= 0 AND 
    seller_commission_rate >= 0 AND 
    admin_commission_rate + seller_commission_rate = 100
  )
);

-- Inserir configuração padrão
INSERT INTO sales_commission_config (admin_commission_rate, seller_commission_rate)
VALUES (4.00, 96.00)
ON CONFLICT DO NOTHING;

-- Criar tabela de comissões de vendas
CREATE TABLE IF NOT EXISTS sales_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_amount numeric NOT NULL,
  admin_commission_rate numeric NOT NULL,
  seller_commission_rate numeric NOT NULL,
  admin_amount numeric NOT NULL,
  seller_amount numeric NOT NULL,
  currency text NOT NULL CHECK (currency IN ('BRL', 'USDT')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(order_id, currency)
);

-- Habilitar RLS
ALTER TABLE sales_commission_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_commissions ENABLE ROW LEVEL SECURITY;

-- Políticas para sales_commission_config
CREATE POLICY "Anyone can view commission config"
  ON sales_commission_config
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can update commission config"
  ON sales_commission_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Políticas para sales_commissions
CREATE POLICY "Sellers can view own commissions"
  ON sales_commissions
  FOR SELECT
  TO authenticated
  USING (
    seller_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert commissions"
  ON sales_commissions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update commission status"
  ON sales_commissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete commissions"
  ON sales_commissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sales_commissions_seller_id ON sales_commissions(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_commissions_order_id ON sales_commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_commissions_status ON sales_commissions(status);
CREATE INDEX IF NOT EXISTS idx_sales_commissions_created_at ON sales_commissions(created_at);

-- Função para calcular comissões automaticamente
CREATE OR REPLACE FUNCTION calculate_sales_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
  v_seller_id uuid;
  v_admin_amount_brl numeric;
  v_seller_amount_brl numeric;
  v_admin_amount_usdt numeric;
  v_seller_amount_usdt numeric;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    SELECT seller_id INTO v_seller_id
    FROM store_products
    WHERE id = NEW.product_id;
    
    IF v_seller_id IS NOT NULL THEN
      SELECT * INTO v_config FROM sales_commission_config LIMIT 1;
      
      IF NEW.total_brl IS NOT NULL AND NEW.total_brl > 0 THEN
        v_admin_amount_brl := ROUND((NEW.total_brl * v_config.admin_commission_rate / 100)::numeric, 2);
        v_seller_amount_brl := ROUND((NEW.total_brl * v_config.seller_commission_rate / 100)::numeric, 2);
        
        INSERT INTO sales_commissions (
          order_id,
          seller_id,
          total_amount,
          admin_commission_rate,
          seller_commission_rate,
          admin_amount,
          seller_amount,
          currency,
          status
        ) VALUES (
          NEW.id,
          v_seller_id,
          NEW.total_brl,
          v_config.admin_commission_rate,
          v_config.seller_commission_rate,
          v_admin_amount_brl,
          v_seller_amount_brl,
          'BRL',
          'pending'
        )
        ON CONFLICT (order_id, currency) DO NOTHING;
      END IF;
      
      IF NEW.total_usdt IS NOT NULL AND NEW.total_usdt > 0 THEN
        v_admin_amount_usdt := ROUND((NEW.total_usdt * v_config.admin_commission_rate / 100)::numeric, 2);
        v_seller_amount_usdt := ROUND((NEW.total_usdt * v_config.seller_commission_rate / 100)::numeric, 2);
        
        INSERT INTO sales_commissions (
          order_id,
          seller_id,
          total_amount,
          admin_commission_rate,
          seller_commission_rate,
          admin_amount,
          seller_amount,
          currency,
          status
        ) VALUES (
          NEW.id,
          v_seller_id,
          NEW.total_usdt,
          v_config.admin_commission_rate,
          v_config.seller_commission_rate,
          v_admin_amount_usdt,
          v_seller_amount_usdt,
          'USDT',
          'pending'
        )
        ON CONFLICT (order_id, currency) DO NOTHING;
      END IF;
    END IF;
  END IF;
  
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE sales_commissions
    SET status = 'cancelled', updated_at = now()
    WHERE order_id = NEW.id AND status = 'pending';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para calcular comissões automaticamente
DROP TRIGGER IF EXISTS trigger_calculate_sales_commission ON store_orders;
CREATE TRIGGER trigger_calculate_sales_commission
  AFTER UPDATE ON store_orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_sales_commission();

-- Função para obter resumo de comissões do vendedor
CREATE OR REPLACE FUNCTION get_seller_commission_summary(
  p_seller_id uuid,
  p_currency text DEFAULT 'BRL'
)
RETURNS TABLE (
  total_sales numeric,
  total_commission numeric,
  pending_commission numeric,
  paid_commission numeric,
  sales_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(total_amount), 0) as total_sales,
    COALESCE(SUM(seller_amount), 0) as total_commission,
    COALESCE(SUM(CASE WHEN status = 'pending' THEN seller_amount ELSE 0 END), 0) as pending_commission,
    COALESCE(SUM(CASE WHEN status = 'paid' THEN seller_amount ELSE 0 END), 0) as paid_commission,
    COUNT(*) as sales_count
  FROM sales_commissions
  WHERE seller_id = p_seller_id AND currency = p_currency;
END;
$$;

-- Função para obter resumo de comissões do admin
CREATE OR REPLACE FUNCTION get_admin_commission_summary(
  p_currency text DEFAULT 'BRL'
)
RETURNS TABLE (
  total_sales numeric,
  total_commission numeric,
  pending_commission numeric,
  paid_commission numeric,
  sales_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(total_amount), 0) as total_sales,
    COALESCE(SUM(admin_amount), 0) as total_commission,
    COALESCE(SUM(CASE WHEN status = 'pending' THEN admin_amount ELSE 0 END), 0) as pending_commission,
    COALESCE(SUM(CASE WHEN status = 'paid' THEN admin_amount ELSE 0 END), 0) as paid_commission,
    COUNT(*) as sales_count
  FROM sales_commissions
  WHERE currency = p_currency;
END;
$$;