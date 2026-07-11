/*
  # Fix create_notification function signature

  1. Function Updates
    - Drop and recreate `create_notification` function with correct parameter types
    - Ensure notification_type parameter accepts text values that match the enum
    - Add proper type casting for notification_type enum

  2. Changes Made
    - Updated function signature to handle notification_type parameter correctly
    - Added explicit type casting to prevent 'unknown' type errors
    - Maintained backward compatibility with existing triggers
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS create_notification(uuid, text, text, text, jsonb, text, timestamp with time zone);
DROP FUNCTION IF EXISTS create_notification(uuid, notification_type, text, text, jsonb, text, timestamp with time zone);
DROP FUNCTION IF EXISTS create_notification(uuid, unknown, text, text, jsonb, text, timestamp with time zone);

-- Create the corrected function with proper type handling
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_data jsonb DEFAULT '{}',
  p_priority text DEFAULT 'medium',
  p_expires_at timestamp with time zone DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  notification_id uuid;
BEGIN
  -- Insert notification with explicit type casting
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    priority,
    expires_at
  ) VALUES (
    p_user_id,
    p_type::notification_type,  -- Explicit cast to enum type
    p_title,
    p_message,
    COALESCE(p_data, '{}'),
    p_priority::notification_priority,  -- Explicit cast to enum type
    p_expires_at
  ) RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_notification(uuid, text, text, text, jsonb, text, timestamp with time zone) TO authenticated;