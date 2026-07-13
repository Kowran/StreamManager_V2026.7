-- Add username (nickname) column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- Add unique constraint on username (case-insensitive via lowercased index)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON profiles (lower(username))
  WHERE username IS NOT NULL;

-- Add a function to check username availability
CREATE OR REPLACE FUNCTION check_username_available(p_username TEXT, p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE lower(username) = lower(p_username)
      AND (p_user_id IS NULL OR id <> p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_username_available(TEXT, UUID) TO authenticated, anon;
