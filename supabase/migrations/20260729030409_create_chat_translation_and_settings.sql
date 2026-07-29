/*
# Chat Translation System and Chat Settings

1. New Tables
- `chat_settings`: Stores per-user chat preferences (auto-translate, preferred translation language, notification settings, etc.)
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, references auth.users, unique) - owner
  - `auto_translate` (boolean, default false) - whether to auto-translate incoming messages
  - `translate_to` (text, default 'en') - target language code for translation (pt, en, es, etc.)
  - `show_original` (boolean, default true) - whether to show original text alongside translation
  - `enter_to_send` (boolean, default true) - whether Enter sends message or creates new line
  - `sound_enabled` (boolean, default true) - whether to play sound on new message
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

- `message_translations`: Caches translated message content so we don't re-translate the same message
  - `id` (uuid, primary key)
  - `message_id` (uuid, not null, references direct_messages) - the message being translated
  - `target_lang` (text, not null) - target language code
  - `translated_text` (text, not null) - the translated content
  - `source_lang` (text) - detected source language (optional)
  - `created_at` (timestamptz)
  - Unique constraint on (message_id, target_lang) to prevent duplicates

2. Security
- Enable RLS on both tables.
- `chat_settings`: owner-scoped CRUD (user can only access their own settings).
- `message_translations`: any authenticated user in the chat can read translations; any authenticated user can insert.

3. Important Notes
- Translation is cached per (message_id, target_lang) so repeated translations don't re-call the API.
- Chat settings default to auto-translate off, English target, showing original text.
*/

CREATE TABLE IF NOT EXISTS chat_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_translate boolean NOT NULL DEFAULT false,
  translate_to text NOT NULL DEFAULT 'en',
  show_original boolean NOT NULL DEFAULT true,
  enter_to_send boolean NOT NULL DEFAULT true,
  sound_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE chat_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chat_settings" ON chat_settings;
CREATE POLICY "select_own_chat_settings" ON chat_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_chat_settings" ON chat_settings;
CREATE POLICY "insert_own_chat_settings" ON chat_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_chat_settings" ON chat_settings;
CREATE POLICY "update_own_chat_settings" ON chat_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_chat_settings" ON chat_settings;
CREATE POLICY "delete_own_chat_settings" ON chat_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS message_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES direct_messages(id) ON DELETE CASCADE,
  target_lang text NOT NULL,
  translated_text text NOT NULL,
  source_lang text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE message_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_message_translations" ON message_translations;
CREATE POLICY "read_message_translations" ON message_translations FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_message_translations" ON message_translations;
CREATE POLICY "insert_message_translations" ON message_translations FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_translations_msg_lang ON message_translations(message_id, target_lang);
