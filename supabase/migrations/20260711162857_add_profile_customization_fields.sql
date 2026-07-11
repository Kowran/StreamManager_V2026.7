/*
# Add profile customization fields

1. Changes to `profiles` table
   - `cover_url` (text): URL da imagem de capa do perfil (armazenada no Supabase Storage)
   - `bio` (text): Biografia/descrição curta do usuário (max 200 chars)
   - `theme_color` (text): Cor tema do perfil (hex), visível para todos
   - `profile_badge` (text): Badge/título customizado do perfil

2. Security
   - Existing RLS policies already cover these new columns (table-level policies)
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS theme_color text DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS profile_badge text;
