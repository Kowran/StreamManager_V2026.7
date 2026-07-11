/*
# Create admin_announcements table

## Purpose
Allows admins to create announcement bars that appear above the site header.
Supports custom colors, scrolling (marquee) text, blinking animation, emojis, and clickable links.

## New Tables
- `admin_announcements`
  - `id` (uuid, primary key)
  - `text` (text, NOT NULL) - the announcement message (may include emojis)
  - `link_url` (text, nullable) - clickable URL
  - `link_text` (text, nullable) - text to display for the link
  - `bg_color` (text, default '#1e40af') - background color (hex or CSS color)
  - `text_color` (text, default '#ffffff') - text color
  - `scroll` (boolean, default true) - if true, text scrolls horizontally (marquee)
  - `blink` (boolean, default false) - if true, text blinks
  - `is_active` (boolean, default true)
  - `priority` (integer, default 0) - higher priority shows first
  - `start_date` (timestamptz, default now)
  - `end_date` (timestamptz, nullable)
  - `created_by` (uuid, FK to auth.users)
  - `created_at` / `updated_at` (timestamps)

## Security
- RLS enabled
- Any authenticated user can SELECT (they need to see announcements)
- Only admins can INSERT/UPDATE/DELETE
- Anon users can also SELECT (announcements visible to everyone, including login page)
*/

CREATE TABLE IF NOT EXISTS admin_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  link_url text,
  link_text text,
  bg_color text NOT NULL DEFAULT '#1e40af',
  text_color text NOT NULL DEFAULT '#ffffff',
  scroll boolean NOT NULL DEFAULT true,
  blink boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_announcements" ON admin_announcements;
CREATE POLICY "anyone_can_read_announcements" ON admin_announcements FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "admins_insert_announcements" ON admin_announcements;
CREATE POLICY "admins_insert_announcements" ON admin_announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "admins_update_announcements" ON admin_announcements;
CREATE POLICY "admins_update_announcements" ON admin_announcements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "admins_delete_announcements" ON admin_announcements;
CREATE POLICY "admins_delete_announcements" ON admin_announcements FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_admin_announcements_active ON admin_announcements (is_active);
