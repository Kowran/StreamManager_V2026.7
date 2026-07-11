/*
  # Ensure all users have affiliate links

  This migration ensures that every user in the system has an affiliate link,
  including users who were created before the affiliate system was implemented.

  1. Creates affiliate links for all users who don't have one
  2. Updates the profiles table with the affiliate codes
  3. Ensures the system is consistent for all users
*/

-- First, let's make sure the function exists and works properly
CREATE OR REPLACE FUNCTION generate_unique_affiliate_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character code with letters and numbers
    new_code := upper(
      substr(md5(random()::text || clock_timestamp()::text), 1, 8)
    );
    
    -- Check if code already exists
    SELECT EXISTS(
      SELECT 1 FROM affiliate_links WHERE code = new_code
    ) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to ensure a user has an affiliate link
CREATE OR REPLACE FUNCTION ensure_user_affiliate_link(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  existing_code TEXT;
  new_code TEXT;
  link_id UUID;
BEGIN
  -- Check if user already has an affiliate link
  SELECT code INTO existing_code
  FROM affiliate_links
  WHERE user_id = p_user_id AND active = true
  LIMIT 1;
  
  IF existing_code IS NOT NULL THEN
    RETURN existing_code;
  END IF;
  
  -- Generate new unique code
  new_code := generate_unique_affiliate_code();
  
  -- Create affiliate link
  INSERT INTO affiliate_links (
    user_id,
    code,
    clicks,
    conversions,
    total_earned,
    active,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    new_code,
    0,
    0,
    0.00,
    true,
    now(),
    now()
  ) RETURNING id INTO link_id;
  
  -- Update user profile with affiliate code
  UPDATE profiles 
  SET 
    affiliate_code = new_code,
    updated_at = now()
  WHERE id = p_user_id;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Now create affiliate links for all users who don't have one
DO $$
DECLARE
  user_record RECORD;
  generated_code TEXT;
BEGIN
  -- Loop through all users who don't have affiliate links
  FOR user_record IN 
    SELECT p.id, p.email, p.full_name
    FROM profiles p
    LEFT JOIN affiliate_links al ON p.id = al.user_id
    WHERE al.id IS NULL
  LOOP
    BEGIN
      -- Create affiliate link for this user
      generated_code := ensure_user_affiliate_link(user_record.id);
      
      RAISE NOTICE 'Created affiliate link for user %: %', user_record.email, generated_code;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to create affiliate link for user %: %', user_record.email, SQLERRM;
      CONTINUE;
    END;
  END LOOP;
END;
$$;

-- Update the trigger to use the new function
DROP TRIGGER IF EXISTS trigger_create_user_affiliate_link ON profiles;

CREATE OR REPLACE FUNCTION create_user_affiliate_link()
RETURNS TRIGGER AS $$
DECLARE
  generated_code TEXT;
BEGIN
  -- Only create if user doesn't already have an affiliate link
  IF NOT EXISTS (
    SELECT 1 FROM affiliate_links WHERE user_id = NEW.id
  ) THEN
    generated_code := ensure_user_affiliate_link(NEW.id);
    RAISE NOTICE 'Created affiliate link for new user %: %', NEW.email, generated_code;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_create_user_affiliate_link
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_user_affiliate_link();

-- Verify that all users now have affiliate links
DO $$
DECLARE
  users_without_links INTEGER;
  total_users INTEGER;
  total_links INTEGER;
BEGIN
  -- Count users without affiliate links
  SELECT COUNT(*) INTO users_without_links
  FROM profiles p
  LEFT JOIN affiliate_links al ON p.id = al.user_id
  WHERE al.id IS NULL;
  
  -- Count total users and links
  SELECT COUNT(*) INTO total_users FROM profiles;
  SELECT COUNT(*) INTO total_links FROM affiliate_links;
  
  RAISE NOTICE 'Migration completed:';
  RAISE NOTICE '- Total users: %', total_users;
  RAISE NOTICE '- Total affiliate links: %', total_links;
  RAISE NOTICE '- Users without links: %', users_without_links;
  
  IF users_without_links > 0 THEN
    RAISE WARNING 'Some users still don''t have affiliate links!';
  ELSE
    RAISE NOTICE 'All users now have affiliate links!';
  END IF;
END;
$$;