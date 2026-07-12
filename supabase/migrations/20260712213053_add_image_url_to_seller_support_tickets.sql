
-- Add image_url to seller_support_tickets for the initial complaint image
ALTER TABLE public.seller_support_tickets ADD COLUMN IF NOT EXISTS image_url text;
