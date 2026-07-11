/*
  # Corrigir Cálculo de Cashback para Usar Valor Absoluto

  1. Alterações
    - Modificar função `award_sm_credits_on_credit_purchase` para calcular cashback sobre o valor absoluto
    - Garantir que o cashback seja sempre 1% do valor da compra, independente do sinal
    - Adicionar log para debug

  2. Motivo
    - O campo `amount` em `credit_transactions` é negativo para compras (dedução)
    - O cashback estava sendo calculado como 1% de um número negativo
    - Agora usa ABS(amount) para garantir valor positivo
*/

-- Função corrigida para calcular cashback de 1% em compras com crédito
CREATE OR REPLACE FUNCTION award_sm_credits_on_credit_purchase()
RETURNS TRIGGER AS $$
DECLARE
  v_cashback_amount numeric(10,2);
  v_current_balance numeric(10,2);
  v_purchase_amount numeric(10,2);
BEGIN
  -- Apenas processar se for uma transação de compra (dedução de crédito)
  IF NEW.type = 'purchase' THEN
    -- Usar valor absoluto do amount para calcular cashback
    -- Como purchases são negativas, precisamos do valor absoluto
    v_purchase_amount := ABS(NEW.amount);
    
    -- Calcular 1% do valor gasto como cashback
    v_cashback_amount := ROUND(v_purchase_amount * 0.01, 2);
    
    -- Log para debug
    RAISE NOTICE 'Calculando cashback: purchase_amount=%, cashback=1%%=%', 
      v_purchase_amount, v_cashback_amount;
    
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
    
    RAISE NOTICE 'Cashback de % SM Créditos creditado para usuário %', 
      v_cashback_amount, NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar o trigger
DROP TRIGGER IF EXISTS trigger_award_sm_credits_on_purchase ON credit_transactions;
CREATE TRIGGER trigger_award_sm_credits_on_purchase
  AFTER INSERT ON credit_transactions
  FOR EACH ROW
  WHEN (NEW.type = 'purchase')
  EXECUTE FUNCTION award_sm_credits_on_credit_purchase();
