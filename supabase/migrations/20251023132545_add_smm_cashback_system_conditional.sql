/*
  # Sistema de Cashback para Painel SMM

  1. Funcionalidades
    - Usuários recebem 1% de cashback em SM Créditos nas compras do painel SMM
    - Cashback é calculado automaticamente quando um pedido SMM é criado
    - Sistema de histórico completo integrado com sm_credit_transactions
    - Funciona de forma similar ao cashback de compras com crédito do site

  2. Triggers
    - Trigger automático para calcular 1% de cashback em pedidos SMM
    - Integrado com o sistema existente de SM Créditos
    - Registra transações com referência ao pedido SMM

  3. Segurança
    - Utiliza as políticas RLS já existentes nas tabelas user_sm_credits e sm_credit_transactions
    - Trigger executado com SECURITY DEFINER para garantir permissões adequadas

  4. Notas
    - Esta migration só será aplicada se a tabela smm_orders existir
    - Compatível com sistemas que já possuem o painel SMM configurado
*/

-- Verificar se a tabela smm_orders existe antes de criar triggers
DO $$
BEGIN
  -- Só criar a função e trigger se a tabela smm_orders existir
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'smm_orders'
  ) THEN
    
    -- Função para conceder SM Créditos como cashback em pedidos SMM
    CREATE OR REPLACE FUNCTION award_sm_credits_on_smm_order()
    RETURNS TRIGGER AS $trigger$
    DECLARE
      v_cashback_amount numeric(10,2);
      v_current_balance numeric(10,2);
    BEGIN
      -- Calcular 1% do valor gasto como cashback
      v_cashback_amount := ROUND(NEW.charge * 0.01, 2);
      
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
        'purchase',
        NEW.id,
        '1% de cashback em pedido SMM'
      );

      RETURN NEW;
    END;
    $trigger$ LANGUAGE plpgsql SECURITY DEFINER;

    -- Trigger para dar cashback em pedidos SMM
    DROP TRIGGER IF EXISTS trigger_award_sm_credits_on_smm_order ON smm_orders;
    CREATE TRIGGER trigger_award_sm_credits_on_smm_order
      AFTER INSERT ON smm_orders
      FOR EACH ROW
      EXECUTE FUNCTION award_sm_credits_on_smm_order();

    -- Processar cashback retroativo para pedidos SMM já realizados
    DECLARE
      v_order RECORD;
      v_cashback_amount numeric(10,2);
      v_current_balance numeric(10,2);
    BEGIN
      FOR v_order IN 
        SELECT id, user_id, charge, created_at
        FROM smm_orders
        ORDER BY created_at ASC
      LOOP
        -- Calcular 1% como cashback
        v_cashback_amount := ROUND(v_order.charge * 0.01, 2);
        
        -- Obter saldo atual
        SELECT COALESCE(balance, 0.00) INTO v_current_balance
        FROM user_sm_credits
        WHERE user_id = v_order.user_id;
        
        -- Verificar se já existe transação de cashback para este pedido
        IF NOT EXISTS (
          SELECT 1 FROM sm_credit_transactions
          WHERE reference_type = 'purchase' 
            AND reference_id = v_order.id
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
            v_order.user_id,
            'cashback',
            v_cashback_amount,
            v_current_balance,
            v_current_balance + v_cashback_amount,
            'purchase',
            v_order.id,
            '1% de cashback em pedido SMM (retroativo)',
            v_order.created_at
          );
        END IF;
      END LOOP;
    END;
    
  END IF;
END $$;
