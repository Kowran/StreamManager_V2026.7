/*
# Add read_accounts tracking to user_purchases

## Purpose
When a customer buys multiple accounts in a single purchase, each account's
credentials should be shown in a collapsible "balloon" that starts hidden.
Only when the user clicks to expand a specific account should it be marked
as "read". This migration adds a JSONB column to track which accounts have
been viewed.

## Changes
1. New column on `user_purchases`:
   - `read_accounts` (jsonb, default '[]') — array of account indices that
     the user has already expanded/viewed. Each entry is the numeric index
     (0-based) of the account in the credentials.accounts array.

2. Security:
   - Adds an UPDATE policy so authenticated users can update the
     `read_accounts` column on their own purchases.

## Notes
- The existing INSERT and SELECT policies remain unchanged.
- The UPDATE policy is scoped to `auth.uid() = user_id`.
- Default is an empty array so all accounts start as "unread".
*/

-- Add read_accounts column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_purchases'
      AND column_name = 'read_accounts'
  ) THEN
    ALTER TABLE user_purchases
    ADD COLUMN read_accounts jsonb NOT NULL DEFAULT '[]';
  END IF;
END $$;

-- Allow users to update their own purchases (for marking accounts as read)
DROP POLICY IF EXISTS "Users can update own purchases" ON user_purchases;
CREATE POLICY "Users can update own purchases"
  ON user_purchases
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
