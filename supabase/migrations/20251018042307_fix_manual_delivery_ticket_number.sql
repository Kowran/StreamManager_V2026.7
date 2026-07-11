/*
  # Corrigir Geração de Ticket Number
  
  1. Problema
    - O trigger não estava gerando ticket_number que é obrigatório
    
  2. Solução
    - Adiciona geração automática de ticket_number no formato TICKET-YYYYMMDD-XXXXX
*/

-- Função para criar ticket de entrega manual automaticamente com ticket_number
CREATE OR REPLACE FUNCTION create_manual_delivery_ticket()
RETURNS TRIGGER AS $$
DECLARE
  product_record RECORD;
  ticket_id uuid;
  category_id uuid;
  ticket_number_generated text;
  ticket_count integer;
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
    
    -- Gerar ticket_number único
    SELECT COUNT(*) + 1 INTO ticket_count
    FROM support_tickets
    WHERE DATE(created_at) = CURRENT_DATE;
    
    ticket_number_generated := 'TICKET-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(ticket_count::text, 5, '0');
    
    -- Criar ticket de suporte
    INSERT INTO support_tickets (
      ticket_number,
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
      ticket_number_generated,
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
        NEW.total_brl,
        NEW.quantity
      ),
      'open',
      'high',
      NOW()
    ) RETURNING id INTO ticket_id;
    
    -- Adicionar mensagem inicial do usuário
    INSERT INTO support_messages (
      ticket_id,
      sender_id,
      message,
      is_internal,
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