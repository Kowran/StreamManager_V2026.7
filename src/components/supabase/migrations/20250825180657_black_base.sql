/*
  # New Support and Ticket System

  1. New Tables
    - `support_categories` - Support categories for better organization
    - `support_tickets` - Main support tickets table
    - `support_messages` - Messages within tickets
    - `support_attachments` - File attachments for tickets

  2. Security
    - Enable RLS on all tables
    - Add policies for users and admins
    - Secure file upload handling

  3. Features
    - Product-linked support tickets
    - Real-time messaging
    - File attachments
    - Priority and status management
    - Admin assignment system
*/

-- Drop existing support tables if they exist
DROP TABLE IF EXISTS support_messages CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;

-- Create support categories table
CREATE TABLE IF NOT EXISTS support_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text DEFAULT 'help-circle',
  color text DEFAULT 'blue',
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES support_categories(id) ON DELETE SET NULL,
  product_id uuid REFERENCES store_products(id) ON DELETE SET NULL,
  order_id uuid REFERENCES store_orders(id) ON DELETE SET NULL,
  subject text NOT NULL,
  description text NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  closed_at timestamptz
);

-- Create support messages table
CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_internal boolean DEFAULT false,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create support attachments table
CREATE TABLE IF NOT EXISTS support_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE,
  message_id uuid REFERENCES support_messages(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_size integer,
  file_type text,
  file_url text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE support_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_categories
CREATE POLICY "Anyone can read active categories"
  ON support_categories
  FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Admins can manage categories"
  ON support_categories
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- RLS Policies for support_tickets
CREATE POLICY "Users can view own tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all tickets"
  ON support_tickets
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Users can create tickets"
  ON support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tickets"
  ON support_tickets
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update all tickets"
  ON support_tickets
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- RLS Policies for support_messages
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

CREATE POLICY "Admins can view all messages"
  ON support_messages
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

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

CREATE POLICY "Admins can create any messages"
  ON support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Users can update own messages"
  ON support_messages
  FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Admins can update all messages"
  ON support_messages
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- RLS Policies for support_attachments
CREATE POLICY "Users can view attachments from own tickets"
  ON support_attachments
  FOR SELECT
  TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM support_tickets 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all attachments"
  ON support_attachments
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Users can upload attachments to own tickets"
  ON support_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ticket_id IN (
      SELECT id FROM support_tickets 
      WHERE user_id = auth.uid()
    )
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Admins can upload attachments to any ticket"
  ON support_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_product_id ON support_tickets(product_id);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON support_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_sender_id ON support_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_support_messages_is_read ON support_messages(is_read) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_support_attachments_ticket_id ON support_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_attachments_message_id ON support_attachments(message_id);

-- Function to generate ticket numbers
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS text AS $$
DECLARE
  new_number text;
  counter integer;
BEGIN
  -- Get current date in YYYYMMDD format
  SELECT TO_CHAR(NOW(), 'YYYYMMDD') INTO new_number;
  
  -- Get count of tickets created today
  SELECT COUNT(*) + 1 INTO counter
  FROM support_tickets 
  WHERE ticket_number LIKE new_number || '%';
  
  -- Format: YYYYMMDD-XXXX (e.g., 20250125-0001)
  new_number := new_number || '-' || LPAD(counter::text, 4, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to update ticket updated_at timestamp
CREATE OR REPLACE FUNCTION update_ticket_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update ticket when new message is added
CREATE OR REPLACE FUNCTION update_ticket_on_message()
RETURNS trigger AS $$
BEGIN
  -- Update ticket timestamp and status if needed
  UPDATE support_tickets 
  SET 
    updated_at = now(),
    status = CASE 
      WHEN status = 'waiting_user' AND NEW.sender_id = (SELECT user_id FROM support_tickets WHERE id = NEW.ticket_id) THEN 'open'
      WHEN status = 'resolved' AND NEW.sender_id = (SELECT user_id FROM support_tickets WHERE id = NEW.ticket_id) THEN 'open'
      ELSE status
    END
  WHERE id = NEW.ticket_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER trigger_update_ticket_timestamp
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_timestamp();

CREATE TRIGGER trigger_update_ticket_on_message
  AFTER INSERT ON support_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_on_message();

-- Trigger to auto-generate ticket number
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_ticket_number
  BEFORE INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_number();

-- Insert default support categories
INSERT INTO support_categories (name, description, icon, color, sort_order) VALUES
('Problemas de Login', 'Dificuldades para acessar a conta ou fazer login', 'key', 'red', 1),
('Credenciais Inválidas', 'Problemas com credenciais de produtos comprados', 'alert-triangle', 'orange', 2),
('Problemas de Pagamento', 'Questões relacionadas a pagamentos e recargas', 'credit-card', 'blue', 3),
('Produto Não Funciona', 'Produto comprado não está funcionando corretamente', 'package', 'purple', 4),
('Solicitação de Reembolso', 'Pedidos de reembolso de compras', 'dollar-sign', 'green', 5),
('Sugestões', 'Sugestões de melhorias para a plataforma', 'lightbulb', 'yellow', 6),
('Outros', 'Outros tipos de problemas ou dúvidas', 'help-circle', 'gray', 7)
ON CONFLICT DO NOTHING;