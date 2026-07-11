/*
  # Remove user approval requirement

  1. Database Changes
    - Set all existing users as approved
    - Update trigger to auto-approve new users
    - Remove approval-related policies if needed

  2. Security
    - Maintain existing RLS policies
    - Ensure users still get proper setup on registration
*/

-- Set all existing users as approved
UPDATE profiles 
SET 
  approved = true,
  approved_at = COALESCE(approved_at, now()),
  approved_by = COALESCE(approved_by, (SELECT id FROM auth.users WHERE email = 'admin@system.com' LIMIT 1)),
  updated_at = now()
WHERE approved = false;

-- Update the handle_admin_user function to auto-approve all new users
CREATE OR REPLACE FUNCTION handle_admin_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-approve all new users
  NEW.approved := true;
  NEW.approved_at := now();
  
  -- Set admin role for specific admin emails if needed
  IF NEW.email = 'admin@henriquestore.com' THEN
    NEW.role := 'admin';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;