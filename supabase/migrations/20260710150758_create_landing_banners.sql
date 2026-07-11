/*
# Create landing_banners table

## Purpose
Rotating banner carousel for the landing page, editable by admins.
Each banner has an image, title, subtitle, link, and display order.

## New Tables
- `landing_banners`
  - `id` (uuid, primary key)
  - `title` (text, NOT NULL) - main banner title
  - `subtitle` (text, nullable) - secondary text
  - `image_url` (text, nullable) - background image URL
  - `link_url` (text, nullable) - clickable URL
  - `link_text` (text, nullable) - CTA button text
  - `bg_color` (text, default '#1e40af') - fallback/overlay color
  - `text_color` (text, default '#ffffff') - text color
  - `text_position` (text, default 'left') - left | center | right
  - `is_active` (boolean, default true)
  - `display_order` (integer, default 0) - lower shows first
  - `created_by` (uuid, FK to auth.users)
  - `created_at` / `updated_at` (timestamps)

## Security
- RLS enabled
- Anyone (anon + authenticated) can SELECT
- Only admins can INSERT/UPDATE/DELETE
*/

CREATE TABLE IF NOT EXISTS landing_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text,
  link_url text,
  link_text text,
  bg_color text NOT NULL DEFAULT '#1e40af',
  text_color text NOT NULL DEFAULT '#ffffff',
  text_position text NOT NULL DEFAULT 'left' CHECK (text_position IN ('left', 'center', 'right')),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE landing_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_landing_banners" ON landing_banners;
CREATE POLICY "anyone_can_read_landing_banners" ON landing_banners FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "admins_insert_landing_banners" ON landing_banners;
CREATE POLICY "admins_insert_landing_banners" ON landing_banners FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "admins_update_landing_banners" ON landing_banners;
CREATE POLICY "admins_update_landing_banners" ON landing_banners FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "admins_delete_landing_banners" ON landing_banners;
CREATE POLICY "admins_delete_landing_banners" ON landing_banners FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_landing_banners_active ON landing_banners (is_active);
