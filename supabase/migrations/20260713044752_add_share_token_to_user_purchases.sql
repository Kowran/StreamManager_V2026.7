/*
# Add share_token to user_purchases

1. Changes
- Add `share_token` column (text, unique, nullable) to `user_purchases`.
- Backfill existing rows with random tokens.
- Add index on `share_token` for lookups.

2. Purpose
- Each purchase gets its own individual, random, unguessable link token
  so users can view their purchase credentials via a unique URL.
*/

ALTER TABLE user_purchases ADD COLUMN IF NOT EXISTS share_token text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_user_purchases_share_token ON user_purchases(share_token);

-- Backfill existing rows with random tokens
UPDATE user_purchases
SET share_token = encode(gen_random_bytes(16), 'hex')
WHERE share_token IS NULL;
