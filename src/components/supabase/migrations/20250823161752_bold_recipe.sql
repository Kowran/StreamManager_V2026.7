/*
  # Sistema de Créditos Recarregáveis

  1. Funcionalidades
    - Administradores podem ajustar créditos de qualquer usuário
    - Usuários podem visualizar seu saldo e histórico
    - Sistema de transações para rastreamento completo
    - Suporte a diferentes tipos de transações (recarga, bônus, dedução, compra, reembolso)

  2. Segurança
    - RLS habilitado em todas as tabelas
    - Usuários só podem ver seus próprios dados
    - Administradores têm acesso completo
    - Transações são imutáveis para auditoria

  3. Triggers e Funções
    - Função para atualizar automaticamente os totais
    - Validações de integridade de dados
*/

-- Função para atualizar totais de crédito do usuário
CREATE OR REPLACE FUNCTION update_user_credit_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar totais baseado no tipo de transação
  IF NEW.type IN ('recharge', 'bonus', 'refund') THEN
    UPDATE user_credits 
    SET 
      balance = NEW.balance_after,
      total_recharged = CASE 
        WHEN NEW.type = 'recharge' THEN total_recharged + NEW.amount
        ELSE total_recharged
      END,
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
  ELSIF NEW.type IN ('purchase', 'deduction') THEN
    UPDATE user_credits 
    SET 
      balance = NEW.balance_after,
      total_spent = CASE 
        WHEN NEW.type = 'purchase' THEN total_spent + NEW.amount
        ELSE total_spent
      END,
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar totais automaticamente
DROP TRIGGER IF EXISTS trigger_update_user_credit_totals ON credit_transactions;
CREATE TRIGGER trigger_update_user_credit_totals
  AFTER INSERT ON credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_credit_totals();

-- Função para validar transações de crédito
CREATE OR REPLACE FUNCTION validate_credit_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar que o valor é positivo
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'O valor da transação deve ser positivo';
  END IF;

  -- Validar que o saldo não fica negativo em deduções
  IF NEW.type IN ('purchase', 'deduction') AND NEW.balance_after < 0 THEN
    RAISE EXCEPTION 'Saldo insuficiente para esta operação';
  END IF;

  -- Validar que os cálculos estão corretos
  IF NEW.type IN ('recharge', 'bonus', 'refund') THEN
    IF NEW.balance_after != NEW.balance_before + NEW.amount THEN
      RAISE EXCEPTION 'Cálculo de saldo incorreto para operação de crédito';
    END IF;
  ELSIF NEW.type IN ('purchase', 'deduction') THEN
    IF NEW.balance_after != NEW.balance_before - NEW.amount THEN
      RAISE EXCEPTION 'Cálculo de saldo incorreto para operação de débito';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar transações
DROP TRIGGER IF EXISTS trigger_validate_credit_transaction ON credit_transactions;
CREATE TRIGGER trigger_validate_credit_transaction
  BEFORE INSERT ON credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_credit_transaction();

-- Políticas RLS atualizadas para administradores
DROP POLICY IF EXISTS "Admins can manage all user credits" ON user_credits;
CREATE POLICY "Admins can manage all user credits"
  ON user_credits
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

DROP POLICY IF EXISTS "Admins can manage all credit transactions" ON credit_transactions;
CREATE POLICY "Admins can manage all credit transactions"
  ON credit_transactions
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
CREATE INDEX IF NOT EXISTS idx_user_credits_balance ON user_credits(balance DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_type ON credit_transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_reference ON credit_transactions(reference_type, reference_id);

-- Inserir dados iniciais para usuários existentes
INSERT INTO user_credits (user_id, balance, total_recharged, total_spent)
SELECT 
  id,
  0.00,
  0.00,
  0.00
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_credits WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;