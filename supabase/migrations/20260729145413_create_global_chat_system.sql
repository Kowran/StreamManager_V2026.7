/*
# Create global chat system (Rhoudz Oficial)

1. New Tables
- `global_chat_messages`
  - `id` (uuid, primary key)
  - `sender_id` (uuid, references profiles, nullable - null for system/admin broadcast)
  - `content` (text, not null - the message text)
  - `image_url` (text, nullable - optional image attachment)
  - `is_admin_message` (boolean, default true - marks as official admin broadcast)
  - `created_at` (timestamptz, default now())
  - Used to store broadcast messages sent by admin to all users.

2. Security
- Enable RLS on `global_chat_messages`.
- SELECT: any authenticated user can read all global chat messages (it's a broadcast to everyone).
- INSERT: only admin users (role = 'admin') can insert messages.
- UPDATE/DELETE: only admin users can update/delete messages.
- This ensures only admins can broadcast, but all users can read.

3. Important Notes
- The `sender_id` references `profiles(id)` with ON DELETE SET NULL so messages persist even if an admin account is deleted.
- `is_admin_message` is always true for now (only admins send), but kept for future flexibility.
- An index on `created_at` ensures efficient message loading in chronological order.
*/

CREATE TABLE IF NOT EXISTS global_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  image_url text,
  is_admin_message boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE global_chat_messages ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read global chat messages (broadcast)
DROP POLICY IF EXISTS "read_global_chat_messages" ON global_chat_messages;
CREATE POLICY "read_global_chat_messages"
ON global_chat_messages FOR SELECT
TO authenticated
USING (true);

-- Only admin users can insert (broadcast) messages
DROP POLICY IF EXISTS "insert_global_chat_messages" ON global_chat_messages;
CREATE POLICY "insert_global_chat_messages"
ON global_chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Only admin users can update messages
DROP POLICY IF EXISTS "update_global_chat_messages" ON global_chat_messages;
CREATE POLICY "update_global_chat_messages"
ON global_chat_messages FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Only admin users can delete messages
DROP POLICY IF EXISTS "delete_global_chat_messages" ON global_chat_messages;
CREATE POLICY "delete_global_chat_messages"
ON global_chat_messages FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Index for efficient chronological loading
CREATE INDEX IF NOT EXISTS idx_global_chat_messages_created_at
ON global_chat_messages (created_at DESC);

-- Track which users have read which global chat messages (for unread count)
CREATE TABLE IF NOT EXISTS global_chat_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE global_chat_reads ENABLE ROW LEVEL SECURITY;

-- Users can read their own read tracking
DROP POLICY IF EXISTS "read_own_global_chat_reads" ON global_chat_reads;
CREATE POLICY "read_own_global_chat_reads"
ON global_chat_reads FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert/update their own read tracking
DROP POLICY IF EXISTS "upsert_own_global_chat_reads" ON global_chat_reads;
CREATE POLICY "upsert_own_global_chat_reads"
ON global_chat_reads FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_global_chat_reads" ON global_chat_reads;
CREATE POLICY "update_own_global_chat_reads"
ON global_chat_reads FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_global_chat_reads" ON global_chat_reads;
CREATE POLICY "delete_own_global_chat_reads"
ON global_chat_reads FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
