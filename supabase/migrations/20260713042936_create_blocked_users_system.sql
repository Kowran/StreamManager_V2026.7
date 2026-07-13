/*
# Create blocked_users table for user blocking functionality

1. New Tables
- `blocked_users`
  - `id` (uuid, primary key)
  - `blocker_id` (uuid, not null, references auth.users) - the user who blocks
  - `blocked_id` (uuid, not null, references auth.users) - the user who is blocked
  - `created_at` (timestamptz, default now())
  - Unique constraint on (blocker_id, blocked_id) to prevent duplicate blocks

2. Security
- Enable RLS on `blocked_users`.
- Users can only SELECT, INSERT, and DELETE their own blocks (where they are the blocker).
- No UPDATE needed - blocks are created or removed, not modified.

3. Important Notes
- A block prevents the blocker from sending messages to the blocked user.
- The blocked user can still see existing chats but cannot receive new messages from the blocker.
- The blocker can unblock at any time by deleting the block record.
*/

CREATE TABLE IF NOT EXISTS blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_blocks" ON blocked_users;
CREATE POLICY "select_own_blocks" ON blocked_users FOR SELECT
  TO authenticated USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "insert_own_blocks" ON blocked_users;
CREATE POLICY "insert_own_blocks" ON blocked_users FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "delete_own_blocks" ON blocked_users;
CREATE POLICY "delete_own_blocks" ON blocked_users FOR DELETE
  TO authenticated USING (auth.uid() = blocker_id);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id);
