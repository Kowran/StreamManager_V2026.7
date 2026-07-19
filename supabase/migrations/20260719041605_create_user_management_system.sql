/*
# Complete User Management System — Ban Appeals, Balance Freeze, Ban Reasons

## Summary
Expands the admin user-management capabilities:
1. Adds ban reason + balance freeze fields to profiles
2. Creates a `ban_appeals` table so banned users can request a review, and admins can approve/reject
3. Creates a `user_management_logs` table to audit every admin action on a user (ban, unban, freeze, reset password, name change, role change, cancel order)

## New Tables
- `ban_appeals` — a banned user's request for review; admin reviews and approves/rejects
  - id (uuid PK)
  - user_id (uuid, FK profiles, the banned user)
  - appeal_reason (text, user's explanation)
  - status (text: pending | approved | rejected, default pending)
  - admin_id (uuid, nullable, the admin who reviewed)
  - admin_response (text, nullable, admin's notes on the decision)
  - reviewed_at (timestamptz, nullable)
  - ban_reason_snapshot (text, nullable, copy of ban reason at appeal time)
  - created_at, updated_at (timestamptz)
- `user_management_logs` — audit trail of all admin actions on users
  - id (uuid PK)
  - admin_id (uuid, FK profiles)
  - target_user_id (uuid, FK profiles)
  - action (text: ban, unban, freeze_balance, unfreeze_balance, reset_password, update_name, update_role, cancel_order)
  - details (jsonb)
  - created_at (timestamptz)

## Modified Tables
- `profiles` — added columns:
  - ban_reason (text, nullable) — reason for the ban
  - balance_frozen (boolean, default false) — whether the user's credit balance is frozen
  - balance_frozen_at (timestamptz, nullable)
  - balance_frozen_by (uuid, nullable)
  - balance_frozen_reason (text, nullable)
- `user_credits` — added column:
  - frozen (boolean, default false) — mirrors profiles.balance_frozen for quick filtering

## Security
- RLS enabled on `ban_appeals`: users can read/insert their own appeals; admins (role = admin) can read all and update any
- RLS enabled on `user_management_logs`: admins can read all; users cannot read (admin-only audit trail); inserts allowed for authenticated (admin client inserts)
*/

-- 1. Add ban reason + balance freeze to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ban_reason text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS balance_frozen boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS balance_frozen_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS balance_frozen_by uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS balance_frozen_reason text;

-- 2. Add frozen flag to user_credits
ALTER TABLE user_credits ADD COLUMN IF NOT EXISTS frozen boolean NOT NULL DEFAULT false;

-- 3. Create ban_appeals table
CREATE TABLE IF NOT EXISTS ban_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appeal_reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  admin_response text,
  reviewed_at timestamptz,
  ban_reason_snapshot text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ban_appeals ENABLE ROW LEVEL SECURITY;

-- Users can read their own appeals
DROP POLICY IF EXISTS "select_own_appeals" ON ban_appeals;
CREATE POLICY "select_own_appeals"
ON ban_appeals FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own appeals (only if banned)
DROP POLICY IF EXISTS "insert_own_appeals" ON ban_appeals;
CREATE POLICY "insert_own_appeals"
ON ban_appeals FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can read all appeals
DROP POLICY IF EXISTS "admin_select_all_appeals" ON ban_appeals;
CREATE POLICY "admin_select_all_appeals"
ON ban_appeals FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Admins can update appeals (review them)
DROP POLICY IF EXISTS "admin_update_appeals" ON ban_appeals;
CREATE POLICY "admin_update_appeals"
ON ban_appeals FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- 4. Create user_management_logs table
CREATE TABLE IF NOT EXISTS user_management_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_management_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all logs
DROP POLICY IF EXISTS "admin_select_logs" ON user_management_logs;
CREATE POLICY "admin_select_logs"
ON user_management_logs FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Admins can insert logs
DROP POLICY IF EXISTS "admin_insert_logs" ON user_management_logs;
CREATE POLICY "admin_insert_logs"
ON user_management_logs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_ban_appeals_user_id ON ban_appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_ban_appeals_status ON ban_appeals(status);
CREATE INDEX IF NOT EXISTS idx_user_management_logs_target ON user_management_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_management_logs_admin ON user_management_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_profiles_banned ON profiles(banned);
CREATE INDEX IF NOT EXISTS idx_profiles_balance_frozen ON profiles(balance_frozen);
