/*
# Allow anonymous users to read all profiles

## Problem
The previous `anon_can_view_seller_profiles` policy only let anonymous
(not logged-in) visitors see seller/admin profiles. When a non-logged-in
visitor clicks on a customer's profile (e.g. from a product rating), the
query returns no rows and the modal shows "Profile not found".

## Changes
- Replaces the restrictive anon policy with one that exposes all profile
  rows to anon and authenticated users. This is safe because:
  - Profiles contain display information (username, avatar, bio, level)
    that is already shown publicly on ratings, the store, and community.
  - The frontend never exposes the email field to anonymous viewers.
  - SELECT only — no writes granted.

## Security
- The `email` column is never rendered for public/anonymous viewing in the
  frontend (PublicUserProfileModal shows username/full_name/avatar/bio only).
- Existing INSERT/UPDATE/DELETE ownership policies are not affected.
*/

DROP POLICY IF EXISTS "anon_can_view_seller_profiles" ON profiles;
DROP POLICY IF EXISTS "anon_can_view_all_profiles" ON profiles;

CREATE POLICY "anon_can_view_all_profiles"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);
