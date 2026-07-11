/*
# Create increment_chat_unread RPC function

Simple function to atomically increment the unread count column for a chat participant.
Called after sending a direct message to notify the recipient.

Parameters:
- p_chat_id: the chat UUID
- p_column: either 'user1_unread' or 'user2_unread'
*/

CREATE OR REPLACE FUNCTION increment_chat_unread(p_chat_id uuid, p_column text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_column = 'user1_unread' THEN
    UPDATE direct_chats SET user1_unread = user1_unread + 1 WHERE id = p_chat_id;
  ELSIF p_column = 'user2_unread' THEN
    UPDATE direct_chats SET user2_unread = user2_unread + 1 WHERE id = p_chat_id;
  END IF;
END;
$$;
