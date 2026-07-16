-- Add mobile/desktop banner image variants and clickable image option
ALTER TABLE landing_banners
  ADD COLUMN IF NOT EXISTS image_url_mobile text,
  ADD COLUMN IF NOT EXISTS image_url_desktop text,
  ADD COLUMN IF NOT EXISTS image_clickable boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN landing_banners.image_url_mobile IS 'Mobile banner image (recommended resolution: 800x400px, max 2MB)';
COMMENT ON COLUMN landing_banners.image_url_desktop IS 'Desktop banner image (recommended resolution: 1920x500px, max 2MB)';
COMMENT ON COLUMN landing_banners.image_clickable IS 'When true, the entire banner image is clickable as a link (no button needed)';
