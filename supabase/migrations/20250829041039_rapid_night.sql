/*
  # Create password reset tokens table

  1. New Tables
    - `password_reset_tokens`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `email` (text)
      - `token` (text, unique)
      - `expires_at` (timestamp)
      - `used` (boolean)
      - `used_at` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `password_reset_tokens` table
    - Add policies for secure token management
    - Add indexes for performance

  3. Functions
    - Add cleanup function for expired tokens
*/

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used ON password_reset_tokens(used) WHERE used = false;

-- RLS Policies
CREATE POLICY "Users cannot access reset tokens directly"
  ON password_reset_tokens
  FOR ALL
  TO authenticated
  USING (false);

-- Only service role can manage reset tokens
CREATE POLICY "Service role can manage reset tokens"
  ON password_reset_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to cleanup expired tokens (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_password_reset_tokens()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM password_reset_tokens 
  WHERE expires_at < now() OR used = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Function to validate reset token
CREATE OR REPLACE FUNCTION validate_password_reset_token(
  p_token text,
  p_email text
)
RETURNS TABLE(
  user_id uuid,
  valid boolean,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  reset_record password_reset_tokens%ROWTYPE;
BEGIN
  -- Find the reset token
  SELECT * INTO reset_record
  FROM password_reset_tokens
  WHERE token = p_token 
    AND email = lower(p_email)
    AND used = false
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN QUERY SELECT null::uuid, false, 'Token inválido ou expirado'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT reset_record.user_id, true, null::text;
END;
$$;