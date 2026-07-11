/*
  # Sistema de Chat para Entrega Manual
  
  1. Mudanças
    - Adiciona categoria "Entrega Manual" para tickets de suporte
    - Cria trigger automático para abrir ticket quando produto manual é comprado
    - Usa sistema de tickets existente como chat entre usuário e admin
    
  2. Funcionalidade
    - Quando pedido com produto manual_delivery=true for pago, cria ticket automaticamente
    - Ticket fica vinculado ao order_id para rastreamento
    - Admin vê ticket e responde com as credenciais do produto
*/

-- Adicionar categoria "Entrega Manual" se não existir
DO $$
DECLARE
  cat_id uuid;
BEGIN
  -- Verificar se categoria já existe
  SELECT id INTO cat_id FROM support_categories WHERE name = 'Entrega Manual';
  
  -- Se não existir, criar
  IF cat_id IS NULL THEN
    INSERT INTO support_categories (name, description, icon, color, active, sort_order)
    VALUES (
      'Entrega Manual',
      'Produtos que requerem entrega manual pelo administrador',
      'Package',
      '#3b82f6',
      true,
      100
    );
  END IF;
END $$;

-- Função para criar ticket de entrega manual automaticamente
CREATE OR REPLACE FUNCTION create_manual_delivery_ticket()
RETURNS TRIGGER AS $$
DECLARE
  product_record RECORD;
  ticket_id uuid;
  category_id uuid;
BEGIN
  -- Só processa se o status mudou para 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    
    -- Buscar informações do produto
    SELECT * INTO product_record
    FROM store_products 
    WHERE id = NEW.product_id;
    
    -- Se produto não existe ou não requer entrega manual, sair
    IF NOT FOUND OR product_record.manual_delivery != true THEN
      RETURN NEW;
    END IF;
    
    -- Buscar ID da categoria "Entrega Manual"
    SELECT id INTO category_id
    FROM support_categories
    WHERE name = 'Entrega Manual'
    LIMIT 1;
    
    -- Criar ticket de suporte
    INSERT INTO support_tickets (
      user_id,
      category_id,
      product_id,
      order_id,
      subject,
      description,
      status,
      priority,
      created_at
    ) VALUES (
      NEW.user_id,
      category_id,
      NEW.product_id,
      NEW.id,
      'Entrega Manual: ' || product_record.name,
      format('Produto comprado: %s
Pedido: %s
Valor pago: R$ %.2f
Quantidade: %s

Aguardando envio das credenciais pelo administrador.',
        product_record.name,
        NEW.id,
        NEW.total_amount,
        NEW.quantity
      ),
      'open',
      'high',
      NOW()
    ) RETURNING id INTO ticket_id;
    
    -- Adicionar mensagem inicial do usuário
    INSERT INTO support_messages (
      ticket_id,
      user_id,
      message,
      is_admin_reply,
      created_at
    ) VALUES (
      ticket_id,
      NEW.user_id,
      format('Olá! Realizei a compra do produto "%s" e aguardo o envio das credenciais. Obrigado!', product_record.name),
      false,
      NOW()
    );
    
    RAISE NOTICE 'Ticket de entrega manual % criado para pedido %', ticket_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para processar entregas manuais
DROP TRIGGER IF EXISTS trigger_create_manual_delivery_ticket ON store_orders;
CREATE TRIGGER trigger_create_manual_delivery_ticket
  AFTER INSERT OR UPDATE ON store_orders
  FOR EACH ROW
  EXECUTE FUNCTION create_manual_delivery_ticket();