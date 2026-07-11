/*
  # Configurar métodos de recarga padrão

  1. Inserir métodos de recarga padrão
    - Recarga Básica: $1 - $50, sem bônus
    - Recarga Premium: $51 - $200, 5% bônus  
    - Recarga VIP: $201 - $1000, 10% bônus

  2. Configurações
    - Todos os métodos ativos por padrão
    - Valores configuráveis pelo admin
    - Sistema de bônus automático
*/

-- Inserir métodos de recarga padrão se não existirem
INSERT INTO credit_recharge_methods (name, description, min_amount, max_amount, bonus_percentage, active)
SELECT 
  'Recarga Básica',
  'Ideal para compras pequenas e testes',
  1.00,
  50.00,
  0.00,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM credit_recharge_methods WHERE name = 'Recarga Básica'
);

INSERT INTO credit_recharge_methods (name, description, min_amount, max_amount, bonus_percentage, active)
SELECT 
  'Recarga Premium',
  'Melhor custo-benefício com bônus de 5%',
  51.00,
  200.00,
  5.00,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM credit_recharge_methods WHERE name = 'Recarga Premium'
);

INSERT INTO credit_recharge_methods (name, description, min_amount, max_amount, bonus_percentage, active)
SELECT 
  'Recarga VIP',
  'Máximo bônus para recargas grandes - 10%',
  201.00,
  1000.00,
  10.00,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM credit_recharge_methods WHERE name = 'Recarga VIP'
);