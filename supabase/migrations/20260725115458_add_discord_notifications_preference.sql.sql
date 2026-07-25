/*
# Add Discord notifications preference

## Overview
Adds a global toggle so each user can opt in/out of receiving notifications via Discord DMs,
independently of the per-event toggles already stored in `discord_user_links`.
This is the master switch surfaced in the user's notification preferences modal.

## Changes
1. `notification_preferences` table:
   - New column `discord_notifications` (boolean, default true).
   - Backfills existing rows to `true` so current users keep receiving Discord notifications.

## Security
- No policy changes. The existing "Users can manage own preferences" policy
  (RLS, `user_id = auth.uid()`) already governs this column.

## Notes
1. Idempotent: uses `IF NOT EXISTS` for the column addition via a DO block.
2. No destructive operations; pure additive change.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notification_preferences'
      AND column_name = 'discord_notifications'
  ) THEN
    ALTER TABLE notification_preferences
      ADD COLUMN discord_notifications boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Backfill any rows that existed before the column was added (default already true,
-- but explicit UPDATE keeps intent clear for any nulls/default edge cases).
UPDATE notification_preferences
SET discord_notifications = true
WHERE discord_notifications IS NULL;
