/*
# Create admin_permissions table

## Purpose
Allows the super-admin to control which specific admin pages each admin user can access.

## New Tables
- `admin_permissions`
  - `id` (uuid, primary key)
  - `admin_user_id` (uuid, FK to profiles) - the admin whose permissions are stored
  - `granted_by` (uuid, FK to profiles) - the super-admin who granted permissions
  - `pages` (text[]) - list of allowed admin page IDs
  - `is_super_admin` (boolean) - if true, bypasses all page checks (full access)
  - `created_at` / `updated_at` (timestamps)

## Security
- RLS enabled
- Admins can read their own permissions row
- Only admins can insert/update/delete (via service role in edge functions)
*/

CREATE TABLE IF NOT EXISTS admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pages text[] NOT NULL DEFAULT '{}',
  is_super_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (admin_user_id)
);

ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_own_permissions" ON admin_permissions;
CREATE POLICY "admins_read_own_permissions" ON admin_permissions FOR SELECT
  TO authenticated
  USING (auth.uid() = admin_user_id);

DROP POLICY IF EXISTS "admins_read_all_permissions" ON admin_permissions;
CREATE POLICY "admins_read_all_permissions" ON admin_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "admins_insert_permissions" ON admin_permissions;
CREATE POLICY "admins_insert_permissions" ON admin_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "admins_update_permissions" ON admin_permissions;
CREATE POLICY "admins_update_permissions" ON admin_permissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "admins_delete_permissions" ON admin_permissions;
CREATE POLICY "admins_delete_permissions" ON admin_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
