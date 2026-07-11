/*
  # Add account expiry notification system

  1. Database Functions
    - Create function to check and notify about expiring accounts
    - Add indexes for better performance on expiry date queries

  2. Scheduled Tasks
    - Set up periodic checking for expiring accounts
    - Log notifications to prevent duplicates

  3. Notification Types
    - 7 days before expiry: Early warning
    - 3 days before expiry: Urgent warning  
    - 1 day before expiry: Critical warning
    - Day of expiry: Final warning
*/

-- Add index for expiry date queries (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'streaming_accounts' 
    AND indexname = 'idx_streaming_accounts_expiry_date'
  ) THEN
    CREATE INDEX idx_streaming_accounts_expiry_date 
    ON streaming_accounts (expiry_date) 
    WHERE expiry_date IS NOT NULL AND status = 'active';
  END IF;
END $$;

-- Add index for user activity logs to prevent duplicate notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'user_activity_logs' 
    AND indexname = 'idx_user_activity_logs_notification_check'
  ) THEN
    CREATE INDEX idx_user_activity_logs_notification_check 
    ON user_activity_logs (user_id, action, created_at, (details->>'account_id'), (details->>'notification_type'))
    WHERE action = 'account_expiry_notification';
  END IF;
END $$;

-- Function to automatically check and create expiry notifications
CREATE OR REPLACE FUNCTION check_and_notify_expiring_accounts()
RETURNS TABLE(
  notifications_created INTEGER,
  accounts_checked INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  account_record RECORD;
  days_until_expiry INTEGER;
  notification_type TEXT;
  notification_title TEXT;
  notification_message TEXT;
  today_start TIMESTAMP;
  today_end TIMESTAMP;
  existing_notification_count INTEGER;
  total_notifications INTEGER := 0;
  total_accounts INTEGER := 0;
BEGIN
  -- Set today's date range
  today_start := DATE_TRUNC('day', NOW());
  today_end := today_start + INTERVAL '1 day' - INTERVAL '1 second';
  
  -- Loop through accounts expiring in the next 7 days
  FOR account_record IN
    SELECT 
      sa.id,
      sa.user_id,
      sa.email,
      sa.expiry_date,
      ss.name as service_name,
      p.email as user_email,
      p.full_name as user_name
    FROM streaming_accounts sa
    LEFT JOIN streaming_services ss ON sa.service_id = ss.id
    LEFT JOIN profiles p ON sa.user_id = p.id
    WHERE sa.status = 'active'
      AND sa.expiry_date IS NOT NULL
      AND sa.user_id IS NOT NULL
      AND sa.expiry_date >= CURRENT_DATE
      AND sa.expiry_date <= CURRENT_DATE + INTERVAL '7 days'
  LOOP
    total_accounts := total_accounts + 1;
    
    -- Calculate days until expiry
    days_until_expiry := (account_record.expiry_date - CURRENT_DATE);
    
    -- Determine notification type and message
    IF days_until_expiry <= 0 THEN
      notification_type := 'expires_today';
      notification_title := '🚨 Conta Expira Hoje!';
      notification_message := format('Sua conta %s (%s) expira hoje! Renove agora para não perder o acesso.',
        COALESCE(account_record.service_name, 'Serviço de Streaming'),
        account_record.email
      );
    ELSIF days_until_expiry <= 1 THEN
      notification_type := 'expires_tomorrow';
      notification_title := '⚠️ Conta Expira Amanhã!';
      notification_message := format('Sua conta %s (%s) expira amanhã! Renove hoje para manter o acesso.',
        COALESCE(account_record.service_name, 'Serviço de Streaming'),
        account_record.email
      );
    ELSIF days_until_expiry <= 3 THEN
      notification_type := 'expires_in_3_days';
      notification_title := '⚠️ Conta Expira em Breve';
      notification_message := format('Sua conta %s (%s) expira em %s dias. Considere renovar em breve.',
        COALESCE(account_record.service_name, 'Serviço de Streaming'),
        account_record.email,
        days_until_expiry
      );
    ELSIF days_until_expiry <= 7 THEN
      notification_type := 'expires_in_7_days';
      notification_title := '📅 Lembrete de Expiração';
      notification_message := format('Sua conta %s (%s) expira em %s dias. Planeje a renovação.',
        COALESCE(account_record.service_name, 'Serviço de Streaming'),
        account_record.email,
        days_until_expiry
      );
    ELSE
      CONTINUE; -- Skip if not in notification range
    END IF;
    
    -- Check if we already sent this type of notification today
    SELECT COUNT(*) INTO existing_notification_count
    FROM user_activity_logs
    WHERE user_id = account_record.user_id
      AND action = 'account_expiry_notification'
      AND created_at >= today_start
      AND created_at <= today_end
      AND details->>'account_id' = account_record.id::text
      AND details->>'notification_type' = notification_type;
    
    -- Only create notification if we haven't sent this type today
    IF existing_notification_count = 0 THEN
      INSERT INTO user_activity_logs (
        user_id,
        action,
        details,
        created_at
      ) VALUES (
        account_record.user_id,
        'account_expiry_notification',
        jsonb_build_object(
          'account_id', account_record.id,
          'service_name', COALESCE(account_record.service_name, 'Serviço de Streaming'),
          'account_email', account_record.email,
          'expiry_date', account_record.expiry_date,
          'days_until_expiry', days_until_expiry,
          'notification_type', notification_type,
          'title', notification_title,
          'message', notification_message,
          'sent_at', NOW()
        ),
        NOW()
      );
      
      total_notifications := total_notifications + 1;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT total_notifications, total_accounts;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_and_notify_expiring_accounts() TO authenticated;

-- Create a trigger to automatically run the check periodically
-- Note: This would typically be set up as a cron job or scheduled task
-- For now, we'll rely on the edge function being called periodically