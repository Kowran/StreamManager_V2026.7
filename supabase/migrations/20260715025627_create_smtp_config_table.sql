/*
# Create SMTP config table for outbound email

1. Purpose
- Stores SMTP server credentials and settings used by edge functions to send
  transactional emails (e.g. seller sale notifications).
- Single-row design: the admin configures one SMTP server for the entire platform.

2. New Tables
- `smtp_config`
  - `id` (uuid, primary key)
  - `host` (text, NOT NULL) — SMTP server hostname (e.g. smtp.gmail.com)
  - `port` (integer, NOT NULL, default 587)
  - `secure` (boolean, NOT NULL, default false) — true for TLS (465), false for STARTTLS (587)
  - `username` (text, NOT NULL) — SMTP auth username
  - `password` (text, NOT NULL) — SMTP auth password
  - `from_email` (text, NOT NULL) — sender email address
  - `from_name` (text, NOT NULL, default 'Marketplace') — sender display name
  - `enabled` (boolean, NOT NULL, default true) — toggle email sending on/off
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

3. Security
- RLS enabled on `smtp_config`.
- Only admin users can SELECT, INSERT, UPDATE, DELETE.
- No access for anon or non-admin authenticated users.
*/

CREATE TABLE IF NOT EXISTS public.smtp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host text NOT NULL,
  port integer NOT NULL DEFAULT 587,
  secure boolean NOT NULL DEFAULT false,
  username text NOT NULL,
  password text NOT NULL,
  from_email text NOT NULL,
  from_name text NOT NULL DEFAULT 'Marketplace',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.smtp_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read the SMTP config
DROP POLICY IF EXISTS "admin_select_smtp_config" ON public.smtp_config;
CREATE POLICY "admin_select_smtp_config"
ON public.smtp_config FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Only admins can insert SMTP config
DROP POLICY IF EXISTS "admin_insert_smtp_config" ON public.smtp_config;
CREATE POLICY "admin_insert_smtp_config"
ON public.smtp_config FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Only admins can update SMTP config
DROP POLICY IF EXISTS "admin_update_smtp_config" ON public.smtp_config;
CREATE POLICY "admin_update_smtp_config"
ON public.smtp_config FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Only admins can delete SMTP config
DROP POLICY IF EXISTS "admin_delete_smtp_config" ON public.smtp_config;
CREATE POLICY "admin_delete_smtp_config"
ON public.smtp_config FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);
