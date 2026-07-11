/*
  # Fix user signup database triggers

  This migration ensures that when a new user signs up through Supabase Auth,
  the necessary profile and credit records are automatically created.

  1. Database Functions
     - `handle_new_user()` - Creates profile record for new users
     - `create_user_credits()` - Creates initial credit record for new users

  2. Triggers
     - `on_auth_user_created` - Triggers profile creation on user signup
     - `on_profile_created` - Triggers credit creation when profile is created

  3. Security
     - Maintains existing RLS policies
     - Ensures proper foreign key relationships
*/

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, language, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    'customer',
    'pt',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create user credits
CREATE OR REPLACE FUNCTION public.create_user_credits()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, total_recharged, total_spent, created_at, updated_at)
  VALUES (
    NEW.id,
    0.00,
    0.00,
    0.00,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create trigger for user credits creation
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_user_credits();