-- Delete messages in self-chats (join with chats where user1_id = user2_id)
DELETE FROM direct_messages
WHERE chat_id IN (
  SELECT id FROM direct_chats WHERE user1_id = user2_id
);

-- Delete direct chats where user1_id = user2_id (self-chats)
DELETE FROM direct_chats WHERE user1_id = user2_id;

-- Auto-finalize store orders older than 3 days that are not yet completed/cancelled/refunded
UPDATE store_orders
SET status = 'completed',
    updated_at = now()
WHERE status NOT IN ('completed', 'cancelled', 'refunded')
  AND created_at < now() - INTERVAL '3 days';

-- Add DB constraint to prevent future self-chats
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'no_self_chat'
    AND conrelid = 'direct_chats'::regclass
  ) THEN
    ALTER TABLE direct_chats ADD CONSTRAINT no_self_chat CHECK (user1_id <> user2_id);
  END IF;
END $$;
