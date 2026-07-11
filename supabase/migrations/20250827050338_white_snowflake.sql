/*
  # Fix create_notification function overload conflict

  1. Problem
    - Two create_notification functions exist with same parameter count but different types
    - One expects text parameters, another expects enum types (notification_type, notification_priority)
    - PostgreSQL cannot determine which function to call, causing PGRST203 error

  2. Solution
    - Drop the function that accepts text parameters for p_type and p_priority
    - Keep the function that uses proper enum types (notification_type, notification_priority)
    - This aligns with the TypeScript types used in the frontend
*/

-- Drop the function that accepts text parameters instead of enum types
DROP FUNCTION IF EXISTS public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_data jsonb,
  p_priority text,
  p_expires_at timestamp with time zone
);