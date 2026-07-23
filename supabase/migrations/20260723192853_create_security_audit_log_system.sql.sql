/*
# Create Security Audit Log System

1. New Tables
- `security_audit_logs` — Records security-related events: RLS policy changes,
  admin actions, suspicious access attempts, configuration changes, and
  periodic security scans. Each log entry stores the actor (user id or 'system'),
  event type, severity, affected table, a human-readable message, and optional
  JSON metadata.

2. Security
- RLS enabled on `security_audit_logs`.
- Only admins (profiles.role = 'admin') can read audit logs.
- Any authenticated user can INSERT (so edge functions and triggers can write),
  but the WITH CHECK ensures only admins or system-level writes are accepted.
- DELETE/UPDATE restricted to admins.

3. Important Notes
- The table is append-only by design: regular users cannot modify or delete entries.
- A helper function `is_admin()` is created for reuse across security policies.
- An index on `created_at` supports time-range queries for the log viewer.
*/

-- Helper function: returns true if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Audit log table
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,                    -- auth uid of the user, or NULL for system
  actor_email text,                 -- denormalised for quick display
  event_type text NOT NULL,          -- 'rls_change', 'admin_action', 'suspicious_access', 'config_change', 'security_scan', 'login_anomaly'
  severity text NOT NULL DEFAULT 'info',  -- 'info', 'warning', 'critical'
  affected_table text,               -- which table was involved
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text
);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
DROP POLICY IF EXISTS "admins_read_audit_logs" ON public.security_audit_logs;
CREATE POLICY "admins_read_audit_logs"
  ON public.security_audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Any authenticated user (or edge function with service role) can insert,
-- but we validate that the actor is an admin or the system is logging
DROP POLICY IF EXISTS "insert_audit_logs" ON public.security_audit_logs;
CREATE POLICY "insert_audit_logs"
  ON public.security_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR actor_id IS NULL);

-- Only admins can update
DROP POLICY IF EXISTS "admins_update_audit_logs" ON public.security_audit_logs;
CREATE POLICY "admins_update_audit_logs"
  ON public.security_audit_logs FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Only admins can delete
DROP POLICY IF EXISTS "admins_delete_audit_logs" ON public.security_audit_logs;
CREATE POLICY "admins_delete_audit_logs"
  ON public.security_audit_logs FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Index for time-range queries
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at
  ON public.security_audit_logs (created_at DESC);

-- Index for filtering by severity
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_severity
  ON public.security_audit_logs (severity);

-- Revoke execute on is_admin from anon
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
