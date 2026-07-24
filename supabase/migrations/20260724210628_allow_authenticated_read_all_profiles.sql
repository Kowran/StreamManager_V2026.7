/*
# Allow authenticated users to read all profiles

## Problem
The `profiles` table only had a SELECT policy exposing seller/admin profiles
(to make the public store work for anonymous visitors). Regular customer
profiles were not readable by any role, so clicking on a customer's profile
(e.g. from a product rating) returned no rows and showed "Profile not found".

## Changes
- Adds a SELECT policy `authenticated_can_read_all_profiles` on `profiles`
  scoped to `TO authenticated` with `USING (true)`. Any signed-in user can
  read any profile row. This is safe because profiles contain display
  information (username, avatar, bio, level) that is meant to be public
  within the app.

## Security
- SELECT only — no writes granted by this policy.
- Anon users still only see seller/admin profiles (unchanged).
- Existing INSERT/UPDATE/DELETE ownership policies are not affected.
*/

DROP POLICY IF EXISTS "authenticated_can_read_all_profiles" ON profiles;
CREATE POLICY "authenticated_can_read_all_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);
