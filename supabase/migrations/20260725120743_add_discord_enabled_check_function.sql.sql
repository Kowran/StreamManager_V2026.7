/*
# Public Discord enabled status check

## Overview
Regular users need to know whether the Discord notification system is configured and enabled
before they try to link their account. The `discord_config` table is admin-only (RLS), so
a normal user cannot read it directly. This migration adds a SECURITY DEFINER function that
returns only the enabled boolean — no tokens or secrets are exposed.

## New Functions
- `is_discord_enabled()`: returns `true` if a row exists in `discord_config` with
  `enabled = true` and a non-null `bot_token`; `false` otherwise. Callable by any
  authenticated user. SECURITY DEFINER so it bypasses RLS to read the config row, but
  it only returns a boolean, never the sensitive column values.

## Security
- The function is SECURITY DEFINER (runs as the table owner) so it can read the
  admin-only `discord_config` table, but it returns only a single boolean. No secrets,
  tokens, or other config fields are exposed to the caller.
- Execution is granted to `authenticated`.
- `search_path` is set to `'public'` per Supabase security guidance.
*/

CREATE OR REPLACE FUNCTION is_discord_enabled()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  is_enabled boolean := false;
BEGIN
  SELECT COALESCE(enabled, false) AND bot_token IS NOT NULL
    INTO is_enabled
    FROM discord_config
    WHERE id = 1;

  RETURN COALESCE(is_enabled, false);
END;
$$;

REVOKE ALL ON FUNCTION is_discord_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_discord_enabled() TO authenticated;
