/*
  # Complete Notification System

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `type` (enum: account_expiry, delivery, payment, support, system, admin)
      - `title` (text)
      - `message` (text)
      - `data` (jsonb, additional notification data)
      - `read` (boolean, default false)
      - `read_at` (timestamp)
      - `priority` (enum: low, medium, high, urgent)
      - `expires_at` (timestamp, optional auto-expiry)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `notification_preferences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `account_expiry_enabled` (boolean, default true)
      - `delivery_enabled` (boolean, default true)
      - `payment_enabled` (boolean, default true)
      - `support_enabled` (boolean, default true)
      - `system_enabled` (boolean, default true)
      - `admin_enabled` (boolean, default true)
      - `email_notifications` (boolean, default false)
      - `push_notifications` (boolean, default false)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for users to manage their own notifications
    - Add policies for admins to send system notifications

  3. Functions
    - Function to create notifications
    - Function to mark notifications as read
    - Function to clean up expired notifications
    - Triggers for automatic notification creation
*/

-- Create notification type enum
CREATE TYPE notification_type AS ENUM (
  'account_expiry',
  'delivery', 
  'payment',
  'support',
  'system',
  'admin',
  'accounts_access_expiry',
  'order_status',
  'credit_low',
  'security'
);

-- Create notification priority enum
CREATE TYPE notification_priority AS ENUM (
  'low',
  'medium', 
  'high',
  'urgent'
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}',
  read boolean DEFAULT false,
  read_at timestamptz,
  priority notification_priority DEFAULT 'medium',
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_expiry_enabled boolean DEFAULT true,
  delivery_enabled boolean DEFAULT true,
  payment_enabled boolean DEFAULT true,
  support_enabled boolean DEFAULT true,
  system_enabled boolean DEFAULT true,
  admin_enabled boolean DEFAULT true,
  accounts_access_expiry_enabled boolean DEFAULT true,
  email_notifications boolean DEFAULT false,
  push_notifications boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can manage all notifications"
  ON notifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Notification preferences policies
CREATE POLICY "Users can manage own preferences"
  ON notification_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Function to create notifications with preference checking
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_type notification_type,
  p_title text,
  p_message text,
  p_data jsonb DEFAULT '{}',
  p_priority notification_priority DEFAULT 'medium',
  p_expires_at timestamptz DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  notification_id uuid;
  user_preferences record;
  preference_enabled boolean := true;
BEGIN
  -- Get user preferences
  SELECT * INTO user_preferences
  FROM notification_preferences
  WHERE user_id = p_user_id;

  -- Check if notification type is enabled for user
  IF user_preferences IS NOT NULL THEN
    CASE p_type
      WHEN 'account_expiry' THEN preference_enabled := user_preferences.account_expiry_enabled;
      WHEN 'delivery' THEN preference_enabled := user_preferences.delivery_enabled;
      WHEN 'payment' THEN preference_enabled := user_preferences.payment_enabled;
      WHEN 'support' THEN preference_enabled := user_preferences.support_enabled;
      WHEN 'system' THEN preference_enabled := user_preferences.system_enabled;
      WHEN 'admin' THEN preference_enabled := user_preferences.admin_enabled;
      WHEN 'accounts_access_expiry' THEN preference_enabled := user_preferences.accounts_access_expiry_enabled;
      ELSE preference_enabled := true;
    END CASE;
  END IF;

  -- Only create notification if enabled
  IF preference_enabled THEN
    INSERT INTO notifications (
      user_id, type, title, message, data, priority, expires_at
    ) VALUES (
      p_user_id, p_type, p_title, p_message, p_data, p_priority, p_expires_at
    ) RETURNING id INTO notification_id;
  END IF;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id uuid)
RETURNS boolean AS $$
BEGIN
  UPDATE notifications 
  SET 
    read = true,
    read_at = now(),
    updated_at = now()
  WHERE id = p_notification_id 
    AND user_id = auth.uid()
    AND read = false;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id uuid DEFAULT NULL)
RETURNS integer AS $$
DECLARE
  target_user_id uuid;
  updated_count integer;
BEGIN
  target_user_id := COALESCE(p_user_id, auth.uid());
  
  UPDATE notifications 
  SET 
    read = true,
    read_at = now(),
    updated_at = now()
  WHERE user_id = target_user_id 
    AND read = false;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM notifications 
  WHERE expires_at IS NOT NULL 
    AND expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create default notification preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS trigger AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default preferences when user profile is created
CREATE TRIGGER trigger_create_notification_preferences
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_preferences();

-- Function to notify on delivery completion
CREATE OR REPLACE FUNCTION notify_delivery_completed()
RETURNS trigger AS $$
DECLARE
  product_name text;
BEGIN
  -- Get product name from delivery content
  product_name := COALESCE(
    NEW.delivery_content->>'product_name',
    'Produto'
  );

  -- Create delivery notification
  PERFORM create_notification(
    NEW.user_id,
    'delivery',
    '🎉 Produto Entregue!',
    format('Seu produto "%s" foi entregue com sucesso! Verifique suas compras para acessar as credenciais.', product_name),
    jsonb_build_object(
      'delivery_id', NEW.id,
      'order_id', NEW.order_id,
      'product_name', product_name,
      'delivery_method', NEW.delivery_method
    ),
    'high',
    now() + interval '7 days'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for delivery notifications
CREATE TRIGGER trigger_notify_delivery_completed
  AFTER INSERT ON store_deliveries
  FOR EACH ROW
  WHEN (NEW.delivery_status = 'delivered')
  EXECUTE FUNCTION notify_delivery_completed();

-- Function to notify on payment completion
CREATE OR REPLACE FUNCTION notify_payment_completed()
RETURNS trigger AS $$
BEGIN
  -- Only notify when status changes to completed
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    PERFORM create_notification(
      NEW.user_id,
      'payment',
      '💰 Recarga Concluída!',
      format('Sua recarga de $%.2f foi processada com sucesso! Seus créditos foram adicionados à sua conta.', NEW.total_credits),
      jsonb_build_object(
        'recharge_id', NEW.id,
        'amount', NEW.total_credits,
        'payment_method', NEW.payment_method,
        'completed_at', NEW.completed_at
      ),
      'high',
      now() + interval '3 days'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for payment completion notifications
CREATE TRIGGER trigger_notify_payment_completed
  AFTER UPDATE ON credit_recharges
  FOR EACH ROW
  EXECUTE FUNCTION notify_payment_completed();

-- Function to notify on support ticket updates
CREATE OR REPLACE FUNCTION notify_support_ticket_update()
RETURNS trigger AS $$
DECLARE
  ticket_data record;
  notification_title text;
  notification_message text;
BEGIN
  -- Get ticket details
  SELECT 
    ticket_number,
    subject,
    status,
    user_id
  INTO ticket_data
  FROM support_tickets
  WHERE id = NEW.ticket_id;

  -- Only notify user when admin responds (not when user sends message)
  IF NEW.sender_id != ticket_data.user_id THEN
    -- Check if sender is admin
    IF EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = NEW.sender_id 
      AND role = 'admin'
    ) THEN
      notification_title := '💬 Nova Resposta do Suporte';
      notification_message := format(
        'Você recebeu uma nova resposta no ticket #%s: "%s"',
        ticket_data.ticket_number,
        ticket_data.subject
      );

      PERFORM create_notification(
        ticket_data.user_id,
        'support',
        notification_title,
        notification_message,
        jsonb_build_object(
          'ticket_id', NEW.ticket_id,
          'ticket_number', ticket_data.ticket_number,
          'message_id', NEW.id,
          'sender_role', 'admin'
        ),
        'high',
        now() + interval '7 days'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for support message notifications
CREATE TRIGGER trigger_notify_support_message
  AFTER INSERT ON support_messages
  FOR EACH ROW
  WHEN (NEW.is_internal = false)
  EXECUTE FUNCTION notify_support_ticket_update();

-- Function to notify on support ticket status changes
CREATE OR REPLACE FUNCTION notify_support_status_change()
RETURNS trigger AS $$
DECLARE
  notification_title text;
  notification_message text;
  status_label text;
BEGIN
  -- Only notify on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Get status label
    CASE NEW.status
      WHEN 'in_progress' THEN status_label := 'Em Andamento';
      WHEN 'waiting_user' THEN status_label := 'Aguardando sua Resposta';
      WHEN 'resolved' THEN status_label := 'Resolvido';
      WHEN 'closed' THEN status_label := 'Fechado';
      ELSE status_label := NEW.status;
    END CASE;

    notification_title := '🎫 Status do Ticket Atualizado';
    notification_message := format(
      'O status do seu ticket #%s foi atualizado para: %s',
      NEW.ticket_number,
      status_label
    );

    PERFORM create_notification(
      NEW.user_id,
      'support',
      notification_title,
      notification_message,
      jsonb_build_object(
        'ticket_id', NEW.id,
        'ticket_number', NEW.ticket_number,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'status_label', status_label
      ),
      CASE NEW.status
        WHEN 'resolved' THEN 'high'
        WHEN 'closed' THEN 'medium'
        ELSE 'medium'
      END,
      now() + interval '7 days'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for support ticket status notifications
CREATE TRIGGER trigger_notify_support_status_change
  AFTER UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_support_status_change();

-- Function to notify on accounts access expiry
CREATE OR REPLACE FUNCTION notify_accounts_access_expiry()
RETURNS integer AS $$
DECLARE
  access_record record;
  notification_count integer := 0;
  days_until_expiry integer;
  notification_title text;
  notification_message text;
BEGIN
  -- Find accounts access expiring in the next 7 days
  FOR access_record IN
    SELECT 
      aap.*,
      p.email,
      p.full_name
    FROM accounts_access_purchases aap
    JOIN profiles p ON p.id = aap.user_id
    WHERE aap.active = true
      AND aap.expires_at > now()
      AND aap.expires_at <= now() + interval '7 days'
  LOOP
    days_until_expiry := EXTRACT(days FROM (access_record.expires_at - now()));
    
    -- Check if we already sent notification today for this access
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = access_record.user_id
        AND type = 'accounts_access_expiry'
        AND data->>'access_id' = access_record.id::text
        AND created_at >= CURRENT_DATE
    ) THEN
      -- Create appropriate notification based on days remaining
      IF days_until_expiry <= 1 THEN
        notification_title := '🚨 Acesso ao Gerenciador Expira Hoje!';
        notification_message := 'Seu acesso ao gerenciador de contas expira hoje! Renove agora para continuar gerenciando suas contas.';
      ELSIF days_until_expiry <= 3 THEN
        notification_title := '⚠️ Acesso ao Gerenciador Expira em Breve';
        notification_message := format('Seu acesso ao gerenciador de contas expira em %s dia%s. Considere renovar em breve.', 
          days_until_expiry, 
          CASE WHEN days_until_expiry > 1 THEN 's' ELSE '' END
        );
      ELSE
        notification_title := '📅 Lembrete: Acesso ao Gerenciador';
        notification_message := format('Seu acesso ao gerenciador de contas expira em %s dias. Planeje a renovação.', days_until_expiry);
      END IF;

      PERFORM create_notification(
        access_record.user_id,
        'accounts_access_expiry',
        notification_title,
        notification_message,
        jsonb_build_object(
          'access_id', access_record.id,
          'expires_at', access_record.expires_at,
          'days_until_expiry', days_until_expiry
        ),
        CASE 
          WHEN days_until_expiry <= 1 THEN 'urgent'
          WHEN days_until_expiry <= 3 THEN 'high'
          ELSE 'medium'
        END,
        access_record.expires_at + interval '1 day'
      );

      notification_count := notification_count + 1;
    END IF;
  END LOOP;

  RETURN notification_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify on streaming account expiry
CREATE OR REPLACE FUNCTION notify_streaming_account_expiry()
RETURNS integer AS $$
DECLARE
  account_record record;
  notification_count integer := 0;
  days_until_expiry integer;
  notification_title text;
  notification_message text;
BEGIN
  -- Find streaming accounts expiring in the next 7 days
  FOR account_record IN
    SELECT 
      sa.*,
      ss.name as service_name,
      p.email,
      p.full_name
    FROM streaming_accounts sa
    JOIN streaming_services ss ON ss.id = sa.service_id
    JOIN profiles p ON p.id = sa.user_id
    WHERE sa.status = 'active'
      AND sa.expiry_date IS NOT NULL
      AND sa.expiry_date > CURRENT_DATE
      AND sa.expiry_date <= CURRENT_DATE + interval '7 days'
  LOOP
    days_until_expiry := EXTRACT(days FROM (account_record.expiry_date::timestamp - now()));
    
    -- Check if we already sent notification today for this account
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id = account_record.user_id
        AND type = 'account_expiry'
        AND data->>'account_id' = account_record.id::text
        AND created_at >= CURRENT_DATE
    ) THEN
      -- Create appropriate notification based on days remaining
      IF days_until_expiry <= 1 THEN
        notification_title := '🚨 Conta Expira Hoje!';
        notification_message := format('Sua conta %s (%s) expira hoje! Renove agora para não perder o acesso.', 
          account_record.service_name, 
          account_record.email
        );
      ELSIF days_until_expiry <= 3 THEN
        notification_title := '⚠️ Conta Expira em Breve';
        notification_message := format('Sua conta %s (%s) expira em %s dia%s. Considere renovar em breve.', 
          account_record.service_name, 
          account_record.email,
          days_until_expiry, 
          CASE WHEN days_until_expiry > 1 THEN 's' ELSE '' END
        );
      ELSE
        notification_title := '📅 Lembrete de Expiração';
        notification_message := format('Sua conta %s (%s) expira em %s dias. Planeje a renovação.', 
          account_record.service_name, 
          account_record.email,
          days_until_expiry
        );
      END IF;

      PERFORM create_notification(
        account_record.user_id,
        'account_expiry',
        notification_title,
        notification_message,
        jsonb_build_object(
          'account_id', account_record.id,
          'service_name', account_record.service_name,
          'account_email', account_record.email,
          'expiry_date', account_record.expiry_date,
          'days_until_expiry', days_until_expiry
        ),
        CASE 
          WHEN days_until_expiry <= 1 THEN 'urgent'
          WHEN days_until_expiry <= 3 THEN 'high'
          ELSE 'medium'
        END,
        account_record.expiry_date::timestamp + interval '1 day'
      );

      notification_count := notification_count + 1;
    END IF;
  END LOOP;

  RETURN notification_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update notification timestamp
CREATE OR REPLACE FUNCTION update_notification_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp on notification changes
CREATE TRIGGER trigger_update_notification_timestamp
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_timestamp();

-- Trigger to update timestamp on preferences changes
CREATE TRIGGER trigger_update_notification_preferences_timestamp
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_timestamp();