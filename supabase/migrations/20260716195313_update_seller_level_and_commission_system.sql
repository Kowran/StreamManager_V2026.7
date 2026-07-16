/*
  # Atualização do Sistema de Vendedor - Taxas e Níveis

  ## Objetivo
  1. Taxa padrão da plataforma: 5% (vendedor fica com 95%)
  2. Tiers de nível com taxas reduzidas: 5%, 4%, 3.5%, 3%, 2.5%
  3. Limite de nível: 100 (antes era 1000)
  4. Curva de XP mais fácil e acessível
  5. Comissão já descontada e visível nos detalhes do pedido

  ## Mudanças
  - xp_for_level: nova curva mais suave (50 * (level-1)^1.5), cap 100
  - level_from_xp: clamp 1-100
  - seller_level_benefits: 5 tiers atualizados
  - sales_commission_config: default 5%/95%
  - XP por venda: 20 XP por dólar (antes 15)
*/

-- ============================================================
-- 1. Atualizar funções de XP para cap 100 e curva mais fácil
-- ============================================================

CREATE OR REPLACE FUNCTION xp_for_level(target_level int)
RETURNS bigint AS $$
BEGIN
  IF target_level <= 1 THEN
    RETURN 0;
  END IF;
  -- Curva mais suave: 50 * (level-1)^1.5
  -- Nivel 10 = 1.350 XP, Nivel 25 = 5.880 XP, Nivel 50 = 17.150 XP, Nivel 100 = 49.250 XP
  RETURN floor(50 * power(target_level - 1, 1.5))::bigint;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION level_from_xp(xp_amount bigint)
RETURNS int AS $$
DECLARE
  lvl int;
BEGIN
  IF xp_amount <= 0 THEN
    RETURN 1;
  END IF;

  lvl := 1;
  WHILE lvl < 100 AND xp_for_level(lvl + 1) <= xp_amount LOOP
    lvl := lvl + 1;
  END LOOP;

  RETURN LEAST(lvl, 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- 2. Atualizar update_seller_level para 20 XP por dólar
-- ============================================================

CREATE OR REPLACE FUNCTION update_seller_level(target_seller uuid)
RETURNS void AS $$
DECLARE
  total_xp bigint := 0;
  new_level int := 1;
BEGIN
  -- 20 XP por dólar vendido (antes era 15)
  SELECT COALESCE(SUM(total_usdt * 20), 0)::bigint
  INTO total_xp
  FROM store_orders
  WHERE seller_id = target_seller
    AND status IN ('completed', 'delivered');

  new_level := level_from_xp(total_xp);

  UPDATE profiles
  SET seller_xp = total_xp,
      seller_level = new_level,
      updated_at = now()
  WHERE id = target_seller;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 3. Atualizar update_user_level para manter consistência (cap 100)
-- ============================================================

CREATE OR REPLACE FUNCTION update_user_level(target_user uuid)
RETURNS void AS $$
DECLARE
  total_xp bigint := 0;
  new_level int := 1;
BEGIN
  -- 10 XP por dólar gasto
  SELECT COALESCE(SUM(total_usdt * 10), 0)::bigint
  INTO total_xp
  FROM store_orders
  WHERE user_id = target_user
    AND status IN ('completed', 'delivered');

  new_level := level_from_xp(total_xp);

  UPDATE profiles
  SET user_xp = total_xp,
      user_level = new_level,
      updated_at = now()
  WHERE id = target_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 4. Atualizar tiers de seller_level_benefits
-- ============================================================

-- Limpar tiers antigos e inserir os novos
DELETE FROM seller_level_benefits;

INSERT INTO seller_level_benefits (min_level, tier_name, admin_commission_rate, seller_commission_rate, icon, color, sort_order, is_active)
VALUES
  (1,   'Iniciante', 5.00, 95.00, 'Sprout',   '#10b981', 1, true),
  (10,  'Bronze',    4.00, 96.00, 'Award',    '#cd7f32', 2, true),
  (25,  'Prata',     3.50, 96.50, 'Medal',    '#94a3b8', 3, true),
  (50,  'Ouro',      3.00, 97.00, 'Crown',    '#f59e0b', 4, true),
  (100, 'Diamante',  2.50, 97.50, 'Gem',      '#3b82f6', 5, true);

-- ============================================================
-- 5. Atualizar configuração global para 5%/95%
-- ============================================================

UPDATE sales_commission_config
SET admin_commission_rate = 5.00,
    seller_commission_rate = 95.00,
    updated_at = now();

-- Garantir que existe pelo menos um registro
INSERT INTO sales_commission_config (admin_commission_rate, seller_commission_rate)
SELECT 5.00, 95.00
WHERE NOT EXISTS (SELECT 1 FROM sales_commission_config);

-- ============================================================
-- 6. Atualizar get_seller_commission_rate fallback para 5%
-- ============================================================

CREATE OR REPLACE FUNCTION get_seller_commission_rate(p_seller_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level integer := 1;
  v_rate numeric;
BEGIN
  SELECT seller_level INTO v_level
  FROM profiles
  WHERE id = p_seller_id;

  SELECT admin_commission_rate INTO v_rate
  FROM seller_level_benefits
  WHERE is_active = true AND min_level <= COALESCE(v_level, 1)
  ORDER BY min_level DESC
  LIMIT 1;

  IF v_rate IS NULL THEN
    SELECT admin_commission_rate INTO v_rate FROM sales_commission_config LIMIT 1;
  END IF;

  RETURN COALESCE(v_rate, 5.00);
END;
$$;

-- ============================================================
-- 7. Recalcular níveis de todos os vendedores e usuários
-- ============================================================

UPDATE profiles p
SET user_xp = COALESCE((
    SELECT (SUM(so.total_usdt) * 10)::bigint
    FROM store_orders so
    WHERE so.user_id = p.id AND so.status IN ('completed', 'delivered')
  ), 0),
    user_level = level_from_xp(COALESCE((
    SELECT (SUM(so.total_usdt) * 10)::bigint
    FROM store_orders so
    WHERE so.user_id = p.id AND so.status IN ('completed', 'delivered')
  ), 0)),
    seller_xp = COALESCE((
    SELECT (SUM(so.total_usdt) * 20)::bigint
    FROM store_orders so
    WHERE so.seller_id = p.id AND so.status IN ('completed', 'delivered')
  ), 0),
    seller_level = level_from_xp(COALESCE((
    SELECT (SUM(so.total_usdt) * 20)::bigint
    FROM store_orders so
    WHERE so.seller_id = p.id AND so.status IN ('completed', 'delivered')
  ), 0));
