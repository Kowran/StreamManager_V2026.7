/*
# Allow anonymous users to read seller/admin profiles

## Purpose
Disconnected (not logged-in) users browsing the store cannot see the seller's
name or avatar on product cards because the `profiles` table only has SELECT
policies scoped to `authenticated`. The store's `loadStoreData()` queries
`profiles` with the anon-key client, so every seller profile lookup returns
null for anonymous visitors.

## Changes
- Adds a new SELECT policy `anon_can_view_seller_profiles` on `profiles`
  scoped to `TO anon, authenticated` that exposes rows where the user is a
  seller or admin (the rows that are already publicly visible to logged-in
  users via the existing "Allow authenticated users to view seller profiles"
  policy).

## Security
- Only seller and admin profiles are exposed — no regular user PII.
- This mirrors the existing authenticated policy but extends it to anon so
  the public store page works for visitors who are not signed in.
- No writes are allowed by this policy (SELECT only).
*/

DROP POLICY IF EXISTS "anon_can_view_seller_profiles" ON profiles;
CREATE POLICY "anon_can_view_seller_profiles"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (role = ANY (ARRAY['seller'::text, 'admin'::text]));
