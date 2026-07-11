/*
  # Add Renewal Prompt Notification Type

  1. Changes
    - Add 'renewal_prompt' to the notification_type enum
    - This allows the system to ask users if they want to renew expired purchases

  2. Purpose
    - Enable renewal prompts when accounts or products expire
    - Allow users to easily renew purchases without manual searching
*/

-- Add renewal_prompt to notification_type enum
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'renewal_prompt' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'renewal_prompt';
  END IF;
END $$;
