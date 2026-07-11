/*
  # Fix User Registration System

  1. Database Functions
    - Update handle_new_user function to be more robust
    - Add better error handling for profile creation
    - Ensure user credits are created properly

  2. Triggers
    - Update trigger to handle edge cases
    - Add proper error handling

  3. Security
    - Maintain existing RLS policies
    - Ensure proper permissions for user creation
*/

-- Drop existing function and recreate with better error handling
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email 
  FROM auth.users 
  WHERE id = NEW.id;
  
  -- If email not found, use the email from the NEW record if available
  IF user_email IS NULL THEN
    user_email := NEW.email;
  END IF;
  
  -- If still no email, use a placeholder
  IF user_email IS NULL THEN
    user_email := 'user@example.com';
  END IF;

  -- Insert into profiles with proper error handling
  BEGIN
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      role,
      language,
      approved,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      user_email,
      NULL,
      'customer',
      'pt',
      false,
      NOW(),
      NOW()
    );
  EXCEPTION 
    WHEN unique_violation THEN
      -- Profile already exists, update it
      UPDATE public.profiles 
      SET 
        email = user_email,
        updated_at = NOW()
      WHERE id = NEW.id;
    WHEN OTHERS THEN
      -- Log error but don't fail the user creation
      RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
  END;

  -- Insert into user_credits with proper error handling
  BEGIN
    INSERT INTO public.user_credits (
      user_id,
      balance,
      total_recharged,
      total_spent,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      0.00,
      0.00,
      0.00,
      NOW(),
      NOW()
    );
  EXCEPTION 
    WHEN unique_violation THEN
      -- Credits already exist, do nothing
      NULL;
    WHEN OTHERS THEN
      -- Log error but don't fail the user creation
      RAISE WARNING 'Error creating user credits for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update existing function to handle admin users
CREATE OR REPLACE FUNCTION handle_admin_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is the first user (make them admin)
  IF (SELECT COUNT(*) FROM public.profiles) = 0 THEN
    NEW.role := 'admin';
    NEW.approved := true;
    NEW.approved_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the admin trigger exists
DROP TRIGGER IF EXISTS set_admin_user_trigger ON public.profiles;
CREATE TRIGGER set_admin_user_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION handle_admin_user();

-- Update create_user_credits function to be more robust
CREATE OR REPLACE FUNCTION create_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create credits if they don't already exist
  INSERT INTO public.user_credits (
    user_id,
    balance,
    total_recharged,
    total_spent,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    0.00,
    0.00,
    0.00,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the credits trigger exists
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION create_user_credits();

-- Add a function to manually fix any users without profiles
CREATE OR REPLACE FUNCTION fix_users_without_profiles()
RETURNS void AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Find users in auth.users that don't have profiles
  FOR user_record IN 
    SELECT au.id, au.email, au.created_at
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    WHERE p.id IS NULL
  LOOP
    -- Create missing profile
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      role,
      language,
      approved,
      created_at,
      updated_at
    ) VALUES (
      user_record.id,
      user_record.email,
      NULL,
      'customer',
      'pt',
      false,
      user_record.created_at,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Create missing user credits
    INSERT INTO public.user_credits (
      user_id,
      balance,
      total_recharged,
      total_spent,
      created_at,
      updated_at
    ) VALUES (
      user_record.id,
      0.00,
      0.00,
      0.00,
      user_record.created_at,
      NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the fix function to repair any existing broken users
SELECT fix_users_without_profiles();

-- Add RPC function to check if user has complete setup
CREATE OR REPLACE FUNCTION check_user_setup(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  has_profile BOOLEAN := false;
  has_credits BOOLEAN := false;
BEGIN
  -- Check if user has profile
  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE id = user_uuid
  ) INTO has_profile;
  
  -- Check if user has credits
  SELECT EXISTS(
    SELECT 1 FROM public.user_credits WHERE user_id = user_uuid
  ) INTO has_credits;
  
  RETURN has_profile AND has_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION check_user_setup(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fix_users_without_profiles() TO authenticated;