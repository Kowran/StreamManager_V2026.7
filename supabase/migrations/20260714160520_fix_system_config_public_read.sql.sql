/*
# Fix: Public read access for storefront config

## Problem
The `system_config` table has RLS enabled with SELECT policies restricted to
admin users only. This means regular authenticated users and anonymous visitors
cannot read `store_config` or `site_settings`, so the landing page, footer,
and store never show the admin-configured logo, site name, social links, etc.

## Fix
Add a new SELECT policy allowing `anon` and `authenticated` to read ONLY the
two public-facing config keys: `store_config` and `site_settings`. All other
keys (cryptomus_config, binance_config, etc.) remain admin-only via the
existing policy. Write policies (INSERT/UPDATE/DELETE) remain admin-only.

## Security
- New policy: `Public can read storefront config` — SELECT for anon+authenticated,
  restricted to `key IN ('store_config', 'site_settings')`.
- Existing admin policies remain unchanged.
*/

DROP POLICY IF EXISTS "Public can read storefront config" ON system_config;
CREATE POLICY "Public can read storefront config"
  ON system_config FOR SELECT
  TO anon, authenticated
  USING (key IN ('store_config', 'site_settings'));
