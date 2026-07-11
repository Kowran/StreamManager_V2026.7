/*
  # Sistema de Expiração de Compras

  1. Modificações na Tabela
    - Adiciona campo `expires_at` na tabela `user_purchases`
    - Adiciona campo `expired` para marcar compras expiradas
    - Adiciona índices para performance

  2. Funções
    - Função para calcular data de expiração (30 dias)
    - Trigger para definir data de expiração automaticamente
    - Função para marcar compras expiradas

  3. Segurança
    - Mantém todas as políticas RLS existentes
*/

-- Adicionar campos de expiração na tabela user_purchases
DO $$
BEGIN
  -- Adicionar campo expires_at se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_purchases' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE user_purchases ADD COLUMN expires_at timestamptz;
  END IF;

  -- Adicionar campo expired se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_purchases' AND column_name = 'expired'
  ) THEN
    ALTER TABLE user_purchases ADD COLUMN expired boolean DEFAULT false;
  END IF;
END $$;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_user_purchases_expires_at 
ON user_purchases (expires_at) 
WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_purchases_expired 
ON user_purchases (expired) 
WHERE expired = false;

CREATE INDEX IF NOT EXISTS idx_user_purchases_user_expired 
ON user_purchases (user_id, expired, expires_at);

-- Função para calcular data de expiração (30 dias a partir da compra)
CREATE OR REPLACE FUNCTION calculate_purchase_expiry(purchase_date timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
BEGIN
  -- Retorna 30 dias após a data de compra
  RETURN purchase_date + INTERVAL '30 days';
END;
$$;

-- Trigger para definir data de expiração automaticamente em novas compras
CREATE OR REPLACE FUNCTION set_purchase_expiry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Define a data de expiração como 30 dias após a compra
  NEW.expires_at := calculate_purchase_expiry(NEW.purchase_date);
  NEW.expired := false;
  
  RETURN NEW;
END;
$$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS trigger_set_purchase_expiry ON user_purchases;
CREATE TRIGGER trigger_set_purchase_expiry
  BEFORE INSERT ON user_purchases
  FOR EACH ROW
  EXECUTE FUNCTION set_purchase_expiry();

-- Função para marcar compras expiradas
CREATE OR REPLACE FUNCTION mark_expired_purchases()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  expired_count integer;
BEGIN
  -- Marcar compras que passaram da data de expiração
  UPDATE user_purchases 
  SET 
    expired = true,
    updated_at = now()
  WHERE 
    expires_at IS NOT NULL 
    AND expires_at < now() 
    AND expired = false;
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  RETURN expired_count;
END;
$$;

-- Atualizar compras existentes para ter data de expiração
UPDATE user_purchases 
SET 
  expires_at = calculate_purchase_expiry(purchase_date),
  expired = CASE 
    WHEN calculate_purchase_expiry(purchase_date) < now() THEN true 
    ELSE false 
  END,
  updated_at = now()
WHERE expires_at IS NULL;

-- Função para obter estatísticas de expiração
CREATE OR REPLACE FUNCTION get_user_purchase_expiry_stats(p_user_id uuid)
RETURNS TABLE(
  total_purchases bigint,
  active_purchases bigint,
  expired_purchases bigint,
  expiring_soon bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_purchases,
    COUNT(*) FILTER (WHERE expired = false AND (expires_at IS NULL OR expires_at > now())) as active_purchases,
    COUNT(*) FILTER (WHERE expired = true OR (expires_at IS NOT NULL AND expires_at <= now())) as expired_purchases,
    COUNT(*) FILTER (WHERE expired = false AND expires_at IS NOT NULL AND expires_at > now() AND expires_at <= now() + INTERVAL '7 days') as expiring_soon
  FROM user_purchases
  WHERE user_id = p_user_id;
END;
$$;

-- Comentário sobre o sistema
COMMENT ON COLUMN user_purchases.expires_at IS 'Data de expiração da compra (30 dias após a compra)';
COMMENT ON COLUMN user_purchases.expired IS 'Indica se a compra já expirou';
COMMENT ON FUNCTION calculate_purchase_expiry(timestamptz) IS 'Calcula data de expiração (30 dias após a compra)';
COMMENT ON FUNCTION mark_expired_purchases() IS 'Marca compras que passaram da data de expiração';
COMMENT ON FUNCTION get_user_purchase_expiry_stats(uuid) IS 'Retorna estatísticas de expiração das compras do usuário';