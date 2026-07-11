-- Add detailed fields to seller_requests table
ALTER TABLE seller_requests
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS store_name text,
  ADD COLUMN IF NOT EXISTS product_examples text,
  ADD COLUMN IF NOT EXISTS binance_id text,
  ADD COLUMN IF NOT EXISTS binance_username text,
  ADD COLUMN IF NOT EXISTS motivation text,
  ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false;

-- Make business_name and description nullable since new form uses different fields
ALTER TABLE seller_requests
  ALTER COLUMN business_name DROP NOT NULL,
  ALTER COLUMN description DROP NOT NULL,
  ALTER COLUMN contact_info DROP NOT NULL;