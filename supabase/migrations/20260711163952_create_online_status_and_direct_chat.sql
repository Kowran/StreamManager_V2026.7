/*
# Online status + direct user-to-user chat

## Changes

### profiles table
- `last_seen_at` (timestamptz): updated via heartbeat every 30s. Used to derive online status (online = last_seen_at > now() - 2 min).

### New table: direct_chats
- Point-to-point conversation between two users.
- `user1_id`, `user2_id`: the two participants (canonical: user1_id < user2_id to avoid duplicates).
- `last_message` (text): preview of last message.
- `last_message_at` (timestamptz): for sorting.
- `user1_unread`, `user2_unread` (int): unread counts per participant.

### New table: direct_messages
- Messages within a direct_chat.
- `chat_id` FK to direct_chats.
- `sender_id` FK to auth.users.
- `content` (text): message body.
- `read_at` (timestamptz): when the other party read it.

## RLS
- All policies scoped to authenticated users.
- Users can only access chats they participate in.
- Users can only send messages as themselves.
*/

-- Add last_seen_at to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();

-- Create direct_chats table
CREATE TABLE IF NOT EXISTS direct_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message text,
  last_message_at timestamptz DEFAULT now(),
  user1_unread int NOT NULL DEFAULT 0,
  user2_unread int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);

ALTER TABLE direct_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_direct_chats" ON direct_chats;
CREATE POLICY "select_own_direct_chats" ON direct_chats FOR SELECT
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "insert_direct_chats" ON direct_chats;
CREATE POLICY "insert_direct_chats" ON direct_chats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "update_direct_chats" ON direct_chats;
CREATE POLICY "update_direct_chats" ON direct_chats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id)
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS "delete_direct_chats" ON direct_chats;
CREATE POLICY "delete_direct_chats" ON direct_chats FOR DELETE
  TO authenticated
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Create direct_messages table
CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES direct_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_direct_messages" ON direct_messages;
CREATE POLICY "select_direct_messages" ON direct_messages FOR SELECT
  TO authenticated
  USING (
    chat_id IN (
      SELECT id FROM direct_chats
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_direct_messages" ON direct_messages;
CREATE POLICY "insert_direct_messages" ON direct_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    chat_id IN (
      SELECT id FROM direct_chats
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_direct_messages" ON direct_messages;
CREATE POLICY "update_direct_messages" ON direct_messages FOR UPDATE
  TO authenticated
  USING (
    chat_id IN (
      SELECT id FROM direct_chats
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_direct_messages" ON direct_messages;
CREATE POLICY "delete_direct_messages" ON direct_messages FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid());

-- Enable realtime for direct_messages and direct_chats
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE direct_chats;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_direct_messages_chat_id ON direct_messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_direct_chats_user1 ON direct_chats(user1_id);
CREATE INDEX IF NOT EXISTS idx_direct_chats_user2 ON direct_chats(user2_id);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles(last_seen_at);
