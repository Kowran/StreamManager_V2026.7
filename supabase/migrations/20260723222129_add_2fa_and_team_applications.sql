/*
# Add 2FA support and team applications system

1. Modified Tables
- `profiles`: Added `two_factor_enabled` (boolean, default false) and `two_factor_secret` (text, nullable) columns
  for two-factor authentication (TOTP) support.

2. New Tables
- `team_applications`: Stores job applications from the "Work with Us" page.
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, nullable for anonymous submissions)
  - `full_name` (text, not null)
  - `email` (text, not null)
  - `phone` (text, nullable)
  - `desired_position` (text, not null)
  - `experience` (text, nullable)
  - `availability` (text, nullable)
  - `portfolio_url` (text, nullable)
  - `message` (text, not null)
  - `status` (text, default 'pending')
  - `created_at` (timestamptz, default now())

3. Security
- RLS enabled on `team_applications`.
- Anyone (anon + authenticated) can submit applications (INSERT).
- Authenticated users can read their own applications.
- Admins can read and update all applications.
- `profiles` columns are covered by existing owner-scoped RLS policies.
*/

-- Add 2FA columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'two_factor_enabled') THEN
    ALTER TABLE profiles ADD COLUMN two_factor_enabled boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'two_factor_secret') THEN
    ALTER TABLE profiles ADD COLUMN two_factor_secret text;
  END IF;
END $$;

-- Create team_applications table
CREATE TABLE IF NOT EXISTS team_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  desired_position text NOT NULL,
  experience text,
  availability text,
  portfolio_url text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE team_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_team_applications" ON team_applications;
CREATE POLICY "select_team_applications" ON team_applications FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "insert_team_applications" ON team_applications;
CREATE POLICY "insert_team_applications" ON team_applications FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_team_applications" ON team_applications;
CREATE POLICY "update_team_applications" ON team_applications FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );