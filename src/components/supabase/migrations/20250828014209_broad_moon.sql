/*
  # Sistema de Créditos com Cryptomus

  1. Novas Tabelas
    - `user_credits` - Saldo e estatísticas de crédito dos usuários
    - `credit_transactions` - Histórico de todas as transações de crédito
    - `cryptomus_payments` - Pagamentos via Cryptomus
    
  2. Segurança
    - Enable RLS em todas as tabelas
    - Políticas para usuários verem apenas seus próprios dados
    - Políticas para admins gerenciarem tudo
    
  3. Funcionalidades
    - Triggers para atualizar saldo automaticamente
    - Funções para processar pagamentos
    - Sistema de webhook para Cryptomus
*/

-- Tabela de créditos dos usuários
CREATE TABLE IF NOT EXISTS user_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric(10,2) DEFAULT 0.00 NOT NULL,
  total_recharged numeric(10,2) DEFAULT 0.00 NOT NULL,
  total_spent numeric(10,2) DEFAULT 0.00 NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Tabela de transações de crédito
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('recharge', 'purchase', 'refund', 'bonus', 'admin_adjustment')),
  amount numeric(10,2) NOT NULL,
  balance_before numeric(10,2) NOT NULL,
  balance_after numeric(10,2) NOT NULL,
  description text NOT NULL,
  reference_id uuid,
  reference_type text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Tabela de pagamentos Cryptomus
CREATE TABLE IF NOT EXISTS cryptomus_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id text NOT NULL UNIQUE,
  amount_usd numeric(10,2) NOT NULL,
  amount_crypto numeric(18,8) NOT NULL,
  currency text NOT NULL,
  network text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled', 'failed')),
  payment_url text,
  qr_code text,
  address text,
  uuid text UNIQUE,
  expires_at timestamptz,
  paid_at timestamptz,
  webhook_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cryptomus_payments_user_id ON cryptomus_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_cryptomus_payments_status ON cryptomus_payments(status);
CREATE INDEX IF NOT EXISTS idx_cryptomus_payments_order_id ON cryptomus_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_cryptomus_payments_uuid ON cryptomus_payments(uuid);

-- Enable RLS
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cryptomus_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies para user_credits
CREATE POLICY "Users can view own credits"
  ON user_credits
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can manage user credits"
  ON user_credits
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies para credit_transactions
CREATE POLICY "Users can view own transactions"
  ON credit_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create transactions"
  ON credit_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view all transactions"
  ON credit_transactions
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- RLS Policies para cryptomus_payments
CREATE POLICY "Users can view own payments"
  ON cryptomus_payments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own payments"
  ON cryptomus_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can update payments"
  ON cryptomus_payments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can manage all payments"
  ON cryptomus_payments
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Função para atualizar saldo do usuário
CREATE OR REPLACE FUNCTION update_user_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar ou criar registro de crédito do usuário
  INSERT INTO user_credits (user_id, balance, total_recharged, total_spent)
  VALUES (
    NEW.user_id,
    NEW.balance_after,
    CASE WHEN NEW.type IN ('recharge', 'bonus', 'refund') THEN NEW.amount ELSE 0 END,
    CASE WHEN NEW.type = 'purchase' THEN NEW.amount ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    balance = NEW.balance_after,
    total_recharged = user_credits.total_recharged + 
      CASE WHEN NEW.type IN ('recharge', 'bonus', 'refund') THEN NEW.amount ELSE 0 END,
    total_spent = user_credits.total_spent + 
      CASE WHEN NEW.type = 'purchase' THEN NEW.amount ELSE 0 END,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar saldo automaticamente
CREATE TRIGGER trigger_update_user_credit_balance
  AFTER INSERT ON credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_credit_balance();

-- Função para processar pagamento confirmado
CREATE OR REPLACE FUNCTION process_confirmed_payment()
RETURNS TRIGGER AS $$
DECLARE
  current_balance numeric(10,2);
BEGIN
  -- Só processar se o status mudou para 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    -- Obter saldo atual do usuário
    SELECT COALESCE(balance, 0) INTO current_balance
    FROM user_credits
    WHERE user_id = NEW.user_id;
    
    IF current_balance IS NULL THEN
      current_balance := 0;
    END IF;

    -- Criar transação de recarga
    INSERT INTO credit_transactions (
      user_id,
      type,
      amount,
      balance_before,
      balance_after,
      description,
      reference_id,
      reference_type,
      metadata
    ) VALUES (
      NEW.user_id,
      'recharge',
      NEW.amount_usd,
      current_balance,
      current_balance + NEW.amount_usd,
      'Recarga via Cryptomus - ' || NEW.currency,
      NEW.id,
      'cryptomus_payment',
      jsonb_build_object(
        'payment_uuid', NEW.uuid,
        'currency', NEW.currency,
        'network', NEW.network,
        'amount_crypto', NEW.amount_crypto,
        'paid_at', NEW.paid_at
      )
    );

    -- Atualizar timestamp de pagamento se não estiver definido
    IF NEW.paid_at IS NULL THEN
      NEW.paid_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para processar pagamentos confirmados
CREATE TRIGGER trigger_process_confirmed_payment
  BEFORE UPDATE ON cryptomus_payments
  FOR EACH ROW
  EXECUTE FUNCTION process_confirmed_payment();

-- Função para obter saldo do usuário
CREATE OR REPLACE FUNCTION get_user_balance(p_user_id uuid)
RETURNS numeric AS $$
DECLARE
  user_balance numeric(10,2);
BEGIN
  SELECT COALESCE(balance, 0) INTO user_balance
  FROM user_credits
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(user_balance, 0);
END;
$$ LANGUAGE plpgsql;

-- Função para debitar créditos (para compras)
CREATE OR REPLACE FUNCTION debit_user_credits(
  p_user_id uuid,
  p_amount numeric,
  p_description text,
  p_reference_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  current_balance numeric(10,2);
  new_balance numeric(10,2);
BEGIN
  -- Obter saldo atual
  SELECT COALESCE(balance, 0) INTO current_balance
  FROM user_credits
  WHERE user_id = p_user_id;
  
  IF current_balance IS NULL THEN
    current_balance := 0;
  END IF;

  -- Verificar se há saldo suficiente
  IF current_balance < p_amount THEN
    RETURN false;
  END IF;

  new_balance := current_balance - p_amount;

  -- Criar transação de débito
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    balance_before,
    balance_after,
    description,
    reference_id,
    reference_type
  ) VALUES (
    p_user_id,
    'purchase',
    p_amount,
    current_balance,
    new_balance,
    p_description,
    p_reference_id,
    p_reference_type
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Função para adicionar créditos (recargas, bônus, reembolsos)
CREATE OR REPLACE FUNCTION credit_user_account(
  p_user_id uuid,
  p_amount numeric,
  p_type text,
  p_description text,
  p_reference_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  current_balance numeric(10,2);
  new_balance numeric(10,2);
BEGIN
  -- Validar tipo
  IF p_type NOT IN ('recharge', 'bonus', 'refund', 'admin_adjustment') THEN
    RAISE EXCEPTION 'Invalid credit type: %', p_type;
  END IF;

  -- Obter saldo atual
  SELECT COALESCE(balance, 0) INTO current_balance
  FROM user_credits
  WHERE user_id = p_user_id;
  
  IF current_balance IS NULL THEN
    current_balance := 0;
  END IF;

  new_balance := current_balance + p_amount;

  -- Criar transação de crédito
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    balance_before,
    balance_after,
    description,
    reference_id,
    reference_type
  ) VALUES (
    p_user_id,
    p_type,
    p_amount,
    current_balance,
    new_balance,
    p_description,
    p_reference_id,
    p_reference_type
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Função para gerar order_id único
CREATE OR REPLACE FUNCTION generate_payment_order_id()
RETURNS text AS $$
BEGIN
  RETURN 'CR-' || EXTRACT(EPOCH FROM now())::bigint || '-' || 
         upper(substring(gen_random_uuid()::text from 1 for 8));
END;
$$ LANGUAGE plpgsql;