/*
# Create Security Center Helper Functions

1. New Functions (all SECURITY DEFINER, search_path = public)
- `get_security_overview()` — Returns one row per public table with RLS status,
  policy counts broken down by CRUD verb, and total row count.
- `get_all_policies(p_table text)` — Returns all RLS policies for public schema
  tables, optionally filtered by table name. Includes policy name, command,
  roles, USING expression, and WITH CHECK expression.
- `get_vulnerable_policies()` — Returns policies that have USING(true) or
  WITH CHECK(true), which are potentially insecure on non-public tables.

2. Security
- All functions are SECURITY DEFINER so they can read pg_catalog / pg_policies.
- EXECUTE revoked from anon; granted to authenticated only.
- Functions are read-only — they only SELECT from system views.

3. Important Notes
- These functions give the admin security center edge function the data it needs
  to display the full security posture of the database.
- get_security_overview uses pg_class.relfilenode for approximate row counts
  (reltuples) to avoid expensive COUNT(*) on large tables.
*/

-- ============================================================
-- get_security_overview: table-level security summary
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_security_overview()
RETURNS TABLE (
  tablename text,
  rls_enabled boolean,
  policy_count bigint,
  select_policies bigint,
  insert_policies bigint,
  update_policies bigint,
  delete_policies bigint,
  approx_rows bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.tablename,
    t.rowsecurity,
    COALESCE(pcnt.total, 0),
    COALESCE(pcnt.sel, 0),
    COALESCE(pcnt.ins, 0),
    COALESCE(pcnt.upd, 0),
    COALESCE(pcnt.del, 0),
    COALESCE(c.reltuples::bigint, 0)
  FROM pg_tables t
  LEFT JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LEFT JOIN LATERAL (
    SELECT
      count(*) as total,
      count(*) FILTER (WHERE cmd = 'SELECT') as sel,
      count(*) FILTER (WHERE cmd = 'INSERT') as ins,
      count(*) FILTER (WHERE cmd = 'UPDATE') as upd,
      count(*) FILTER (WHERE cmd = 'DELETE') as del
    FROM pg_policies pp
    WHERE pp.schemaname = 'public' AND pp.tablename = t.tablename
  ) pcnt ON true
  WHERE t.schemaname = 'public'
  ORDER BY t.tablename;
$$;

-- ============================================================
-- get_all_policies: detailed policy listing
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_all_policies(p_table text DEFAULT NULL)
RETURNS TABLE (
  tablename text,
  policyname text,
  cmd text,
  roles text[],
  qual text,
  with_check text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pp.tablename,
    pp.policyname,
    pp.cmd,
    pp.roles,
    pp.qual,
    pp.with_check
  FROM pg_policies pp
  WHERE pp.schemaname = 'public'
    AND (p_table IS NULL OR pp.tablename = p_table)
  ORDER BY pp.tablename, pp.cmd;
$$;

-- ============================================================
-- get_vulnerable_policies: policies with USING(true) or WITH CHECK(true)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_vulnerable_policies()
RETURNS TABLE (
  tablename text,
  policyname text,
  cmd text,
  roles text[],
  qual text,
  with_check text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pp.tablename,
    pp.policyname,
    pp.cmd,
    pp.roles,
    pp.qual,
    pp.with_check
  FROM pg_policies pp
  WHERE pp.schemaname = 'public'
    AND (
      pp.qual = 'true'
      OR pp.with_check = 'true'
    )
  ORDER BY pp.tablename, pp.cmd;
$$;

-- Revoke from anon, grant to authenticated
REVOKE EXECUTE ON FUNCTION public.get_security_overview() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_all_policies(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_vulnerable_policies() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_security_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_policies(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vulnerable_policies() TO authenticated;
