/*
  # Sistema de Entrega de Pedidos

  1. Funções
    - `handle_automatic_delivery()` - Processa entregas automáticas quando pedido é pago
    - `update_product_stock_quantity()` - Atualiza quantidade em estoque baseado nas linhas disponíveis

  2. Triggers
    - Trigger na tabela `store_orders` para processar entregas automáticas
    - Trigger na tabela `product_stock_lines` para atualizar estoque

  3. Melhorias
    - Entrega automática pega a conta mais antiga disponível
    - Produtos manuais ficam pendentes para admin processar
    - Sistema robusto de controle de estoque
*/

-- Função para processar entregas automáticas
CREATE OR REPLACE FUNCTION handle_automatic_delivery()
RETURNS TRIGGER AS $$
DECLARE
  product_record RECORD;
  stock_line RECORD;
  delivery_content JSONB;
BEGIN
  -- Só processa se o status mudou para 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    
    -- Buscar informações do produto
    SELECT * INTO product_record
    FROM store_products 
    WHERE id = NEW.product_id;
    
    -- Se produto não existe, sair
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;
    
    -- Se produto tem entrega automática habilitada
    IF product_record.auto_delivery = true THEN
      
      -- Buscar a linha de estoque mais antiga disponível
      SELECT * INTO stock_line
      FROM product_stock_lines
      WHERE product_id = NEW.product_id
        AND status = 'available'
        AND (reserved_until IS NULL OR reserved_until < NOW())
      ORDER BY created_at ASC
      LIMIT 1;
      
      -- Se encontrou estoque disponível
      IF FOUND THEN
        
        -- Marcar linha como vendida
        UPDATE product_stock_lines
        SET 
          status = 'sold',
          sold_at = NOW(),
          order_id = NEW.id,
          updated_at = NOW()
        WHERE id = stock_line.id;
        
        -- Preparar conteúdo da entrega
        delivery_content := jsonb_build_object(
          'product_name', product_record.name,
          'account_credentials', jsonb_build_object(
            'email', stock_line.email,
            'password', stock_line.password,
            'instructions', COALESCE(stock_line.instructions, 'Use estas credenciais para acessar sua conta.')
          ),
          'delivery_info', jsonb_build_object(
            'delivered_at', NOW(),
            'delivery_method', 'automatic',
            'product_category', product_record.category,
            'stock_line_id', stock_line.id
          ),
          'instructions', COALESCE(stock_line.instructions, 'Use estas credenciais para acessar sua conta.'),
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
        
        RAISE NOTICE 'Entrega automática processada para pedido %', NEW.id;
        
      ELSE
        -- Sem estoque disponível - produto fica pendente
        RAISE NOTICE 'Sem estoque disponível para produto % no pedido %', product_record.name, NEW.id;
      END IF;
      
    ELSE
      -- Produto com entrega manual - não faz nada, admin deve processar
      RAISE NOTICE 'Produto % requer entrega manual - pedido % aguardando admin', product_record.name, NEW.id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar quantidade em estoque
CREATE OR REPLACE FUNCTION update_product_stock_quantity()
RETURNS TRIGGER AS $$
DECLARE
  available_count INTEGER;
BEGIN
  -- Determinar o product_id baseado na operação
  IF TG_OP = 'DELETE' THEN
    -- Contar linhas disponíveis para o produto deletado
    SELECT COUNT(*) INTO available_count
    FROM product_stock_lines
    WHERE product_id = OLD.product_id
      AND status = 'available';
    
    -- Atualizar quantidade do produto
    UPDATE store_products
    SET 
      stock_quantity = available_count,
      updated_at = NOW()
    WHERE id = OLD.product_id;
    
    RETURN OLD;
  ELSE
    -- Para INSERT e UPDATE
    SELECT COUNT(*) INTO available_count
    FROM product_stock_lines
    WHERE product_id = NEW.product_id
      AND status = 'available';
    
    -- Atualizar quantidade do produto
    UPDATE store_products
    SET 
      stock_quantity = available_count,
      updated_at = NOW()
    WHERE id = NEW.product_id;
    
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Remover triggers existentes se existirem
DROP TRIGGER IF EXISTS trigger_automatic_delivery ON store_orders;
DROP TRIGGER IF EXISTS trigger_update_product_stock ON product_stock_lines;

-- Criar trigger para entrega automática
CREATE TRIGGER trigger_automatic_delivery
  AFTER UPDATE ON store_orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_automatic_delivery();

-- Criar trigger para atualizar estoque
CREATE TRIGGER trigger_update_product_stock
  AFTER INSERT OR UPDATE OR DELETE ON product_stock_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_product_stock_quantity();

-- Função auxiliar para processar entrega de um pedido específico (para uso manual)
CREATE OR REPLACE FUNCTION handle_automatic_delivery_for_order(order_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  order_record RECORD;
  product_record RECORD;
  stock_line RECORD;
  delivery_content JSONB;
BEGIN
  -- Buscar o pedido
  SELECT * INTO order_record
  FROM store_orders 
  WHERE id = order_id AND status = 'paid';
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Buscar informações do produto
  SELECT * INTO product_record
  FROM store_products 
  WHERE id = order_record.product_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Só processa se tem entrega automática
  IF product_record.auto_delivery != true THEN
    RETURN FALSE;
  END IF;
  
  -- Buscar a linha de estoque mais antiga disponível
  SELECT * INTO stock_line
  FROM product_stock_lines
  WHERE product_id = order_record.product_id
    AND status = 'available'
    AND (reserved_until IS NULL OR reserved_until < NOW())
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- Se não encontrou estoque, retorna false
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Marcar linha como vendida
  UPDATE product_stock_lines
  SET 
    status = 'sold',
    sold_at = NOW(),
    order_id = order_record.id,
    updated_at = NOW()
  WHERE id = stock_line.id;
  
  -- Preparar conteúdo da entrega
  delivery_content := jsonb_build_object(
    'product_name', product_record.name,
    'account_credentials', jsonb_build_object(
      'email', stock_line.email,
      'password', stock_line.password,
      'instructions', COALESCE(stock_line.instructions, 'Use estas credenciais para acessar sua conta.')
    ),
    'delivery_info', jsonb_build_object(
      'delivered_at', NOW(),
      'delivery_method', 'automatic_manual',
      'product_category', product_record.category,
      'stock_line_id', stock_line.id
    ),
    'instructions', COALESCE(stock_line.instructions, 'Use estas credenciais para acessar sua conta.'),
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
    order_record.id,
    order_record.product_id,
    order_record.user_id,
    delivery_content,
    'automatic',
    'delivered',
    NOW()
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;