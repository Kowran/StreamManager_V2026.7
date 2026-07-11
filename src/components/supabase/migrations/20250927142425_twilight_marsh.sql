/*
  # Remove Email Configuration System

  1. Changes
    - Remove email configuration from system_config table
    - Clean up any email-related configurations
    - Remove password reset tokens table (no longer needed)

  2. Notes
    - System now uses Supabase native email functionality
    - Password reset is handled by Supabase Auth
    - No custom SMTP configuration needed
*/

-- Remove email configuration from system_config
DELETE FROM system_config WHERE key = 'email_config';

-- Drop password reset tokens table if it exists
DROP TABLE IF EXISTS password_reset_tokens CASCADE;

-- Add comment about email system change
COMMENT ON TABLE system_config IS 'System configuration table. Email functionality now handled by Supabase Auth natively.';