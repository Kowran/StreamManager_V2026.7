/*
# Add outbound translation language to chat settings

1. Modified Tables
- `chat_settings`: Added `outbound_translate_to` column (text, nullable) - target language code for translating outbound messages before sending. NULL means no outbound translation.

2. Security
- No new policies needed; existing owner-scoped CRUD policies on chat_settings cover the new column.

3. Important Notes
- When `outbound_translate_to` is NULL, outbound messages are sent as-is without translation.
- When set to a language code (e.g. 'en', 'es'), the user can translate their typed message to that language before sending.
*/

ALTER TABLE chat_settings ADD COLUMN IF NOT EXISTS outbound_translate_to text;
