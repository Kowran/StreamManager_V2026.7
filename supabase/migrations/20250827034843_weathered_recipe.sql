/*
  # Atualizar políticas de mensagens de suporte

  1. Políticas Atualizadas
    - Usuários podem ver todas as mensagens não-internas de seus tickets
    - Admins podem ver todas as mensagens (incluindo internas)
    - Melhor sincronização entre chat do usuário e admin

  2. Segurança
    - Mantém RLS ativo
    - Usuários só veem mensagens de seus próprios tickets
    - Mensagens internas ficam visíveis apenas para admins
*/

-- Remover políticas existentes para support_messages
DROP POLICY IF EXISTS "Admins can manage all messages" ON support_messages;
DROP POLICY IF EXISTS "Users can create messages in own tickets" ON support_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON support_messages;
DROP POLICY IF EXISTS "Users can view non-internal messages from own tickets" ON support_messages;

-- Criar novas políticas mais claras
CREATE POLICY "Admins can manage all support messages"
  ON support_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view messages from own tickets"
  ON support_messages
  FOR SELECT
  TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE user_id = auth.uid()
    )
    AND is_internal = false
  );

CREATE POLICY "Users can create messages in own tickets"
  ON support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ticket_id IN (
      SELECT id FROM support_tickets
      WHERE user_id = auth.uid()
    )
    AND sender_id = auth.uid()
    AND is_internal = false
  );

CREATE POLICY "Users can update own messages"
  ON support_messages
  FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Atualizar função de trigger para melhor sincronização
CREATE OR REPLACE FUNCTION update_ticket_on_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar timestamp do ticket
  UPDATE support_tickets 
  SET updated_at = NEW.created_at
  WHERE id = NEW.ticket_id;
  
  -- Se a mensagem é de um usuário (não admin) e o ticket estava resolvido, reabrir como 'in_progress'
  IF NOT NEW.is_internal AND NEW.sender_id != (
    SELECT id FROM profiles WHERE id = NEW.sender_id AND role = 'admin'
  ) THEN
    UPDATE support_tickets 
    SET status = CASE 
      WHEN status = 'resolved' THEN 'in_progress'
      WHEN status = 'closed' THEN 'in_progress'
      ELSE status
    END,
    updated_at = NEW.created_at
    WHERE id = NEW.ticket_id;
  END IF;
  
  -- Se a mensagem é de um admin para um ticket aberto, marcar como 'waiting_user'
  IF NOT NEW.is_internal AND EXISTS (
    SELECT 1 FROM profiles WHERE id = NEW.sender_id AND role = 'admin'
  ) THEN
    UPDATE support_tickets 
    SET status = CASE 
      WHEN status = 'open' THEN 'waiting_user'
      WHEN status = 'in_progress' THEN 'waiting_user'
      ELSE status
    END,
    updated_at = NEW.created_at
    WHERE id = NEW.ticket_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar o trigger
DROP TRIGGER IF EXISTS trigger_update_ticket_on_message ON support_messages;
CREATE TRIGGER trigger_update_ticket_on_message
  AFTER INSERT ON support_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_on_message();