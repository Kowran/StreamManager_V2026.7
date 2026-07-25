-- Remove duplicate Discord links, keeping the most recently updated one per discord_user_id
DELETE FROM discord_user_links
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY discord_user_id
             ORDER BY updated_at DESC
           ) AS rn
    FROM discord_user_links
    WHERE discord_user_id IS NOT NULL
  ) t
  WHERE rn > 1
);

-- Enforce one platform account per Discord account.
-- NULL discord_user_id is allowed (pending links), so use a partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_discord_user_links_discord_user_id
  ON discord_user_links (discord_user_id)
  WHERE discord_user_id IS NOT NULL;
