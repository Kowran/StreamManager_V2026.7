/*
  # Add Audio Support to Community Posts

  1. Changes
    - Add `audio_url` column to `community_posts` table
      - Allows admins to attach audio files to community posts
      - Optional field (can be null)
    
  2. Notes
    - This enables admins to share audio messages with the community
    - Audio URL should point to a hosted audio file (mp3, wav, etc.)
*/

-- Add audio_url column to community_posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_posts' AND column_name = 'audio_url'
  ) THEN
    ALTER TABLE community_posts ADD COLUMN audio_url text;
  END IF;
END $$;