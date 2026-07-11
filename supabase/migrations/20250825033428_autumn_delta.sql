/*
  # Corrigir Sistema de Entrega Automática

  1. Funções
    - Atualizar função de entrega automática para consumir estoque
    - Melhorar entrega de credenciais estruturadas
  
  2. Triggers
    - Garantir que trigger de entrega automática funcione corretamente
    - Atualizar estoque automaticamente
  
  3. Melhorias
    - Entrega de credenciais no formato correto
    - Controle adequado do estoque
*/

-- Função melhorada para entrega automática
CREATE OR REPLACE FUNCTION handle_automatic_delivery()
RETURNS TRIGGER AS $$
DECLARE
  product_record RECORD;
  available_stock RECORD;
  delivery_content JSONB;
BEGIN
  -- Verificar se o status mudou para 'paid'
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    
    -- Buscar informações do produto
    SELECT * INTO product_record
    FROM store_products 
    WHERE id = NEW.product_id;
    
    -- Verificar se o produto existe e tem entrega automática
    IF product_record IS NULL THEN
      RAISE EXCEPTION 'Produto não encontrado: %', NEW.product_id;
    END IF;
    
    -- Se não for entrega automática, não fazer nada
    IF NOT product_record.auto_delivery THEN
      RETURN NEW;
    END IF;
    
    -- Buscar uma conta disponível no estoque
    SELECT * INTO available_stock
    FROM product_stock_lines
    WHERE product_id = NEW.product_id 
      AND status = 'available'
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- Se não há estoque disponível, não entregar
    IF available_stock IS NULL THEN
      RAISE NOTICE 'Sem estoque disponível para produto: %', product_record.name;
      RETURN NEW;
    END IF;
    
    -- Marcar a conta como vendida
    UPDATE product_stock_lines
    SET 
      status = 'sold',
      sold_at = NOW(),
      order_id = NEW.id,
      updated_at = NOW()
    WHERE id = available_stock.id;
    
    -- Preparar conteúdo de entrega estruturado
    delivery_content := jsonb_build_object(
      'product_name', product_record.name,
      'account_credentials', jsonb_build_object(
        'email', available_stock.email,
        'password', available_stock.password,
        'instructions', COALESCE(available_stock.instructions, 'Use estas credenciais para acessar sua conta.')
      ),
      'delivery_info', jsonb_build_object(
        'delivered_at', NOW(),
        'delivery_method', 'automatic',
        'product_category', product_record.category,
        'stock_line_id', available_stock.id
      ),
      'instructions', COALESCE(available_stock.instructions, 'Use estas credenciais para acessar sua conta.'),
      'additional_info', jsonb_build_object(
        'support_contact', '+5584996105167',
        'validity', 'Credenciais válidas por tempo indeterminado',
        'important_notes', 'Guarde estas informações em local seguro'
      )
    );
    
    -- Criar registro de entrega
    INSERT INTO store_deliveries (
      order_id,
      product_id,
      user_id,
      delivery_content,
      delivery_method,
      delivery_status,
      delivered_at
    ) VALUES (
      NEW.id,
      NEW.product_id,
      NEW.user_id,
      delivery_content,
      'automatic',
      'delivered',
      NOW()
    );
    
    RAISE NOTICE 'Entrega automática realizada para pedido: % com conta: %', NEW.id, available_stock.email;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar o trigger para garantir que funcione
DROP TRIGGER IF EXISTS trigger_automatic_delivery ON store_orders;
CREATE TRIGGER trigger_automatic_delivery
  AFTER UPDATE ON store_orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_automatic_delivery();

-- Função para atualizar quantidade de estoque automaticamente
CREATE OR REPLACE FUNCTION update_product_stock_quantity()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar a quantidade de estoque do produto
  UPDATE store_products
  SET 
    stock_quantity = (
      SELECT COUNT(*)
      FROM product_stock_lines
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
        AND status = 'available'
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recriar o trigger de atualização de estoque
DROP TRIGGER IF EXISTS trigger_update_product_stock ON product_stock_lines;
CREATE TRIGGER trigger_update_product_stock
  AFTER INSERT OR UPDATE OR DELETE ON product_stock_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_product_stock_quantity();

-- Atualizar todas as quantidades de estoque existentes
UPDATE store_products
SET stock_quantity = (
  SELECT COUNT(*)
  FROM product_stock_lines
  WHERE product_id = store_products.id
    AND status = 'available'
)
WHERE id IN (
  SELECT DISTINCT product_id
  FROM product_stock_lines
  WHERE product_id IS NOT NULL
);