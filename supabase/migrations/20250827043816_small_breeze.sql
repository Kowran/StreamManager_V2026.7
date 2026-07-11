/*
  # Fix create_notification function signature

  1. Function Updates
    - Fix create_notification function to properly handle notification_type enum
    - Add proper type casting for enum parameters
    - Ensure function signature matches trigger calls

  2. Security
    - Maintain existing RLS policies
    - Preserve function security settings
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS create_notification(uuid, text, text, text, jsonb, text, timestamp with time zone);
DROP FUNCTION IF EXISTS create_notification(uuid, notification_type, text, text, jsonb, notification_priority, timestamp with time zone);

-- Create the notification function with proper type handling
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_data jsonb DEFAULT '{}'::jsonb,
  p_priority text DEFAULT 'medium',
  p_expires_at timestamp with time zone DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id uuid;
  user_preferences record;
BEGIN
  -- Get user notification preferences
  SELECT * INTO user_preferences
  FROM notification_preferences
  WHERE user_id = p_user_id;

  -- If no preferences exist, create default ones
  IF user_preferences IS NULL THEN
    INSERT INTO notification_preferences (
      user_id,
      account_expiry_enabled,
      delivery_enabled,
      payment_enabled,
      support_enabled,
      system_enabled,
      admin_enabled,
      accounts_access_expiry_enabled,
      email_notifications,
      push_notifications
    ) VALUES (
      p_user_id,
      true, true, true, true, true, true, true, false, false
    );
    
    -- Get the newly created preferences
    SELECT * INTO user_preferences
    FROM notification_preferences
    WHERE user_id = p_user_id;
  END IF;

  -- Check if this type of notification is enabled for the user
  IF (p_type = 'account_expiry' AND NOT user_preferences.account_expiry_enabled) OR
     (p_type = 'delivery' AND NOT user_preferences.delivery_enabled) OR
     (p_type = 'payment' AND NOT user_preferences.payment_enabled) OR
     (p_type = 'support' AND NOT user_preferences.support_enabled) OR
     (p_type = 'system' AND NOT user_preferences.system_enabled) OR
     (p_type = 'admin' AND NOT user_preferences.admin_enabled) OR
     (p_type = 'accounts_access_expiry' AND NOT user_preferences.accounts_access_expiry_enabled) THEN
    -- User has disabled this type of notification
    RETURN NULL;
  END IF;

  -- Create the notification with proper type casting
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    priority,
    expires_at,
    read,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_type::notification_type,
    p_title,
    p_message,
    p_data,
    p_priority::notification_priority,
    p_expires_at,
    false,
    now(),
    now()
  ) RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

-- Create function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Create function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id uuid;
  updated_count integer;
BEGIN
  -- Use provided user_id or current authenticated user
  target_user_id := COALESCE(p_user_id, auth.uid());
  
  IF target_user_id IS NULL THEN
    RETURN 0;
  END IF;

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
$$;

-- Create function to clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM notifications
  WHERE expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;