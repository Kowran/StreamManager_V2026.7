/*
# Create Flying Balloon System

1. New Tables
- `flying_balloons` — admin-configured flying balloon that appears in the bottom-right corner for all users.
  - `id` (uuid, primary key)
  - `name` (text, internal label for admin)
  - `image_url` (text, URL of the balloon image)
  - `link_url` (text, URL opened when user clicks the balloon)
  - `link_target` (text, '_blank' or '_self', default '_blank')
  - `effect` (text, animation effect: 'floating', 'static', 'blinking', 'bouncing', 'pulsing', default 'floating')
  - `size` (integer, balloon size in pixels, default 80)
  - `position_bottom` (integer, distance from bottom in pixels, default 24)
  - `position_right` (integer, distance from right in pixels, default 24)
  - `is_active` (boolean, default false)
  - `start_date` (timestamptz, when balloon becomes visible)
  - `end_date` (timestamptz, when balloon stops being visible, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  - `created_by` (uuid, admin who created it)

2. Modified Tables
- `profiles` — add column `hide_expiring_balloon` (boolean, default false) to let streaming-manager users disable the expiring-items floating balloon.

3. Security
- Enable RLS on `flying_balloons`.
- Admin-only CRUD (role check via profiles table).
- All authenticated users can read active balloons (so they see them in the UI).
- Users can update their own `hide_expiring_balloon` preference on profiles.

4. Important Notes
- Only one balloon should be active at a time (enforced in app logic, not DB).
- The `hide_expiring_balloon` column lets streaming-manager users opt out of the expiring-items chat balloon without affecting admin-configured flying balloons.
*/

CREATE TABLE IF NOT EXISTS flying_balloons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Balão',
  image_url text NOT NULL,
  link_url text,
  link_target text NOT NULL DEFAULT '_blank',
  effect text NOT NULL DEFAULT 'floating' CHECK (effect IN ('floating', 'static', 'blinking', 'bouncing', 'pulsing')),
  size integer NOT NULL DEFAULT 80,
  position_bottom integer NOT NULL DEFAULT 24,
  position_right integer NOT NULL DEFAULT 24,
  is_active boolean NOT NULL DEFAULT false,
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE flying_balloons ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active balloons
DROP POLICY IF EXISTS "read_flying_balloons" ON flying_balloons;
CREATE POLICY "read_flying_balloons"
ON flying_balloons FOR SELECT
TO authenticated USING (true);

-- Only admins can insert
DROP POLICY IF EXISTS "insert_flying_balloons_admin" ON flying_balloons;
CREATE POLICY "insert_flying_balloons_admin"
ON flying_balloons FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Only admins can update
DROP POLICY IF EXISTS "update_flying_balloons_admin" ON flying_balloons;
CREATE POLICY "update_flying_balloons_admin"
ON flying_balloons FOR UPDATE
TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Only admins can delete
DROP POLICY IF EXISTS "delete_flying_balloons_admin" ON flying_balloons;
CREATE POLICY "delete_flying_balloons_admin"
ON flying_balloons FOR DELETE
TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Add hide_expiring_balloon column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'hide_expiring_balloon'
  ) THEN
    ALTER TABLE profiles ADD COLUMN hide_expiring_balloon boolean NOT NULL DEFAULT false;
  END IF;
END $$;