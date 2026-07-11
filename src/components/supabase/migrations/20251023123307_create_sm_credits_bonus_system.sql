/*
  # Sistema de Moeda Secundária - SM Créditos

  1. Funcionalidades
    - Moeda secundária chamada "SM Créditos" que funciona como cashback
    - Usuários recebem 1% do valor gasto em compras como SM Créditos
    - SM Créditos são calculados automaticamente em todas as compras com crédito do site
    - Sistema de histórico completo de ganhos de SM Créditos
    - Administradores podem ajustar SM Créditos manualmente

  2. Tabelas Criadas
    - `user_sm_credits` - Armazena saldo de SM Créditos de cada usuário
      - `user_id` (uuid, foreign key to auth.users)
      - `balance` (numeric, saldo atual)
      - `total_earned` (numeric, total ganho ao longo do tempo)
      - `total_spent` (numeric, total gasto)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `sm_credit_transactions` - Histórico de transações de SM Créditos
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `type` (text, tipo: cashback/bonus/deduction/admin_adjustment)
      - `amount` (numeric, valor da transação)
      - `balance_before` (numeric, saldo anterior)
      - `balance_after` (numeric, saldo posterior)
      - `reference_type` (text, referência: purchase/credit_transaction/manual)
      - `reference_id` (uuid, id da referência)
      - `description` (text, descrição)
      - `created_by` (uuid, quem criou - para ajustes manuais)
      - `created_at` (timestamp)

  3. Triggers e Funções
    - Trigger automático para calcular 1% de cashback em compras com crédito
    - Função para atualizar saldo de SM Créditos
    - Validações de integridade

  4. Segurança
    - RLS habilitado em todas as tabelas
    - Usuários só podem ver seus próprios SM Créditos
    - Administradores têm acesso completo
    - Transações são auditáveis
*/

-- Tabela de saldo de SM Créditos dos usuários
CREATE TABLE IF NOT EXISTS user_sm_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric(10,2) DEFAULT 0.00 NOT NULL,
  total_earned numeric(10,2) DEFAULT 0.00 NOT NULL,
  total_spent numeric(10,2) DEFAULT 0.00 NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de transações de SM Créditos
CREATE TABLE IF NOT EXISTS sm_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('cashback', 'bonus', 'deduction', 'admin_adjustment')),
  amount numeric(10,2) NOT NULL,
  balance_before numeric(10,2) NOT NULL,
  balance_after numeric(10,2) NOT NULL,
  reference_type text CHECK (reference_type IN ('purchase', 'credit_transaction', 'manual')),
  reference_id uuid,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE user_sm_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE sm_credit_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas para user_sm_credits
CREATE POLICY "Users can view own SM credits"
  ON user_sm_credits
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert SM credits"
  ON user_sm_credits
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can update SM credits"
  ON user_sm_credits
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all SM credits"
  ON user_sm_credits
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

-- Políticas para sm_credit_transactions
CREATE POLICY "Users can view own SM credit transactions"
  ON sm_credit_transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert SM credit transactions"
  ON sm_credit_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR created_by = auth.uid());

CREATE POLICY "Admins can manage all SM credit transactions"
  ON sm_credit_transactions
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

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_sm_credits_balance ON user_sm_credits(balance DESC);
CREATE INDEX IF NOT EXISTS idx_sm_credit_transactions_user_id ON sm_credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_sm_credit_transactions_type ON sm_credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_sm_credit_transactions_created_at ON sm_credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sm_credit_transactions_reference ON sm_credit_transactions(reference_type, reference_id);

-- Função para atualizar saldo de SM Créditos
CREATE OR REPLACE FUNCTION update_user_sm_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Garantir que o registro existe em user_sm_credits
  INSERT INTO user_sm_credits (user_id, balance, total_earned, total_spent)
  VALUES (NEW.user_id, 0.00, 0.00, 0.00)
  ON CONFLICT (user_id) DO NOTHING;

  -- Atualizar saldo baseado no tipo de transação
  IF NEW.type IN ('cashback', 'bonus') THEN
    UPDATE user_sm_credits 
    SET 
      balance = NEW.balance_after,
      total_earned = total_earned + NEW.amount,
      updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSIF NEW.type IN ('deduction') THEN
    UPDATE user_sm_credits 
    SET 
      balance = NEW.balance_after,
      total_spent = total_spent + NEW.amount,
      updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSIF NEW.type = 'admin_adjustment' THEN
    -- Para ajustes manuais, apenas atualizar o saldo
    UPDATE user_sm_credits 
    SET 
      balance = NEW.balance_after,
      total_earned = CASE 
        WHEN NEW.amount > 0 THEN total_earned + NEW.amount
        ELSE total_earned
      END,
      total_spent = CASE 
        WHEN NEW.amount < 0 THEN total_spent + ABS(NEW.amount)
        ELSE total_spent
      END,
      updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para atualizar saldo de SM Créditos
DROP TRIGGER IF EXISTS trigger_update_user_sm_credit_balance ON sm_credit_transactions;
CREATE TRIGGER trigger_update_user_sm_credit_balance
  AFTER INSERT ON sm_credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_sm_credit_balance();

-- Função para calcular cashback de 1% em compras com crédito
CREATE OR REPLACE FUNCTION award_sm_credits_on_credit_purchase()
RETURNS TRIGGER AS $$
DECLARE
  v_cashback_amount numeric(10,2);
  v_current_balance numeric(10,2);
BEGIN
  -- Apenas processar se for uma transação de compra (dedução de crédito)
  IF NEW.type = 'purchase' THEN
    -- Calcular 1% do valor gasto como cashback
    v_cashback_amount := ROUND(NEW.amount * 0.01, 2);
    
    -- Obter saldo atual de SM Créditos (ou 0 se não existir)
    SELECT COALESCE(balance, 0.00) INTO v_current_balance
    FROM user_sm_credits
    WHERE user_id = NEW.user_id;
    
    -- Se não encontrou, significa que é o primeiro registro
    IF NOT FOUND THEN
      v_current_balance := 0.00;
    END IF;
    
    -- Criar transação de cashback
    INSERT INTO sm_credit_transactions (
      user_id,
      type,
      amount,
      balance_before,
      balance_after,
      reference_type,
      reference_id,
      description
    ) VALUES (
      NEW.user_id,
      'cashback',
      v_cashback_amount,
      v_current_balance,
      v_current_balance + v_cashback_amount,
      'credit_transaction',
      NEW.id,
      '1% de cashback em compra com crédito'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para dar cashback em compras com crédito
DROP TRIGGER IF EXISTS trigger_award_sm_credits_on_purchase ON credit_transactions;
CREATE TRIGGER trigger_award_sm_credits_on_purchase
  AFTER INSERT ON credit_transactions
  FOR EACH ROW
  WHEN (NEW.type = 'purchase')
  EXECUTE FUNCTION award_sm_credits_on_credit_purchase();

-- Inicializar registros de SM Créditos para todos os usuários existentes
INSERT INTO user_sm_credits (user_id, balance, total_earned, total_spent)
SELECT 
  id,
  0.00,
  0.00,
  0.00
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_sm_credits)
ON CONFLICT (user_id) DO NOTHING;

-- Processar cashback retroativo para compras já realizadas com crédito
DO $$
DECLARE
  v_transaction RECORD;
  v_cashback_amount numeric(10,2);
  v_current_balance numeric(10,2);
BEGIN
  FOR v_transaction IN 
    SELECT id, user_id, amount, created_at
    FROM credit_transactions
    WHERE type = 'purchase'
    ORDER BY created_at ASC
  LOOP
    -- Calcular 1% como cashback
    v_cashback_amount := ROUND(v_transaction.amount * 0.01, 2);
    
    -- Obter saldo atual
    SELECT COALESCE(balance, 0.00) INTO v_current_balance
    FROM user_sm_credits
    WHERE user_id = v_transaction.user_id;
    
    -- Verificar se já existe transação de cashback para esta compra
    IF NOT EXISTS (
      SELECT 1 FROM sm_credit_transactions
      WHERE reference_type = 'credit_transaction' 
        AND reference_id = v_transaction.id
        AND type = 'cashback'
    ) THEN
      -- Criar transação de cashback retroativo
      INSERT INTO sm_credit_transactions (
        user_id,
        type,
        amount,
        balance_before,
        balance_after,
        reference_type,
        reference_id,
        description,
        created_at
      ) VALUES (
        v_transaction.user_id,
        'cashback',
        v_cashback_amount,
        v_current_balance,
        v_current_balance + v_cashback_amount,
        'credit_transaction',
        v_transaction.id,
        '1% de cashback em compra com crédito (retroativo)',
        v_transaction.created_at
      );
    END IF;
  END LOOP;
END $$;
