/*
# Add store_suspended flag to profiles

1. Changes to `profiles` table
   - `store_suspended` (boolean, default false): When true, a seller's store is
     suspended. The user keeps the 'seller' role (so they can still sign in and
     BUY from other sellers) but is blocked from creating/editing products and
     from receiving new sales. Existing listed products remain but are
     effectively paused via app-level checks.

2. Security
   - No new policies needed: `profiles` already has table-level RLS. The admin
     user-management flow already allows admins to update profiles. The new
     column is covered by existing table-scoped UPDATE policies.

3. Important notes
   - Suspension is independent of the `role` value. A suspended seller stays a
     seller (preserves store config, ratings, slug) — only selling is blocked.
   - Re-activating simply sets the flag back to false; no data is lost.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS store_suspended boolean DEFAULT false;
