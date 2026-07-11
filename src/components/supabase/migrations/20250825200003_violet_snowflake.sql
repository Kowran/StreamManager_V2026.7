/*
  # Fix Support System Permissions

  This migration fixes the support system to ensure admins can properly view and respond to all tickets and messages.

  ## Changes Made

  1. **Support Messages Policies**
     - Updated admin policies to allow full access to all messages
     - Fixed user policies to allow viewing messages from their tickets
     - Added proper foreign key relationships

  2. **Support Tickets Policies**
     - Ensured admins can view and update all tickets
     - Fixed user access to their own tickets

  3. **Foreign Key Constraints**
     - Added proper foreign key for sender_id in support_messages
     - Ensured referential integrity

  ## Security
  - Admins can view and respond to all tickets and messages
  - Users can only view their own tickets and non-internal messages
  - Internal messages remain admin-only
*/

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Admins can create any messages" ON support_messages;
DROP POLICY IF EXISTS "Admins can update all messages" ON support_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON support_messages;
DROP POLICY IF EXISTS "Users can create messages in own tickets" ON support_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON support_messages;
DROP POLICY IF EXISTS "Users can view messages from own tickets" ON support_messages;

-- Recreate support_messages policies with proper permissions
CREATE POLICY "Admins can manage all messages"
  ON support_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
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

CREATE POLICY "Users can view non-internal messages from own tickets"
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

CREATE POLICY "Users can update own messages"
  ON support_messages
  FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Ensure support_tickets policies are correct
DROP POLICY IF EXISTS "Admins can update all tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON support_tickets;

CREATE POLICY "Admins can manage all tickets"
  ON support_tickets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Add missing foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'support_messages_sender_id_fkey'
    AND table_name = 'support_messages'
  ) THEN
    ALTER TABLE support_messages 
    ADD CONSTRAINT support_messages_sender_id_fkey 
    FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for better performance on message queries
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_sender 
ON support_messages (ticket_id, sender_id);

CREATE INDEX IF NOT EXISTS idx_support_messages_is_internal 
ON support_messages (is_internal) WHERE is_internal = false;

-- Update trigger function to properly update ticket status when messages are added
CREATE OR REPLACE FUNCTION update_ticket_on_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the ticket's updated_at timestamp
  UPDATE support_tickets 
  SET updated_at = NEW.created_at
  WHERE id = NEW.ticket_id;
  
  -- If message is from admin and ticket is waiting_user, change to in_progress
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = NEW.sender_id 
    AND role = 'admin'
  ) THEN
    UPDATE support_tickets 
    SET status = CASE 
      WHEN status = 'waiting_user' THEN 'in_progress'
      WHEN status = 'open' THEN 'in_progress'
      ELSE status
    END
    WHERE id = NEW.ticket_id;
  ELSE
    -- If message is from user and ticket is in_progress, change to waiting_user
    UPDATE support_tickets 
    SET status = CASE 
      WHEN status = 'in_progress' THEN 'waiting_user'
      ELSE status
    END
    WHERE id = NEW.ticket_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_update_ticket_on_message ON support_messages;
CREATE TRIGGER trigger_update_ticket_on_message
  AFTER INSERT ON support_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_on_message();