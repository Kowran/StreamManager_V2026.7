/*
  # Fix handle_new_user trigger function

  1. Database Functions
    - Update `handle_new_user()` function to properly handle profile creation
    - Ensure all required fields are provided with proper defaults
    - Add error handling to prevent signup failures

  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS during trigger execution
    - Ensures profile creation works regardless of RLS policies

  3. Changes
    - Fix any column mismatches between trigger and profiles table
    - Add proper error handling and logging
    - Ensure trigger only runs for actual user signups
*/

-- Drop and recreate the handle_new_user function with proper error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only proceed if this is a confirmed user (not just email verification)
  IF NEW.email_confirmed_at IS NOT NULL OR NEW.confirmed_at IS NOT NULL THEN
    -- Insert into profiles table with proper error handling
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
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      'customer',
      COALESCE(NEW.raw_user_meta_data->>'language', 'en'),
      false,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING; -- Prevent duplicate key errors
    
    -- Create user credits record
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
    ON CONFLICT (user_id) DO NOTHING; -- Prevent duplicate key errors
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the signup
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();