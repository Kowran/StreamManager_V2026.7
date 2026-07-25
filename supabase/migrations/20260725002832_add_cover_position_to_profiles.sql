/*
# Add cover_position field to profiles

1. Changes to `profiles` table
   - `cover_position` (numeric): Vertical position offset for the cover image, stored as a
     percentage (0-100) where 50 = centered. Allows users to reposition their profile cover
     image (like Facebook/Twitter). Defaults to 50 (center). Read by all, written by owner.

2. Security
   - No new policies needed: `profiles` already has table-level RLS policies covering
     SELECT (owner) and UPDATE (owner). The new column is automatically covered by the
     existing policies since they are table-scoped, not column-scoped.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cover_position numeric DEFAULT 50;
