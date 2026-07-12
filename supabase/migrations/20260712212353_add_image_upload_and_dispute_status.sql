
-- Add image_url to support messages for both seller support and direct chat
ALTER TABLE public.seller_support_messages ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS image_url text;

-- Add dispute status to store_orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'store_orders' AND column_name = 'dispute_opened_at'
  ) THEN
    ALTER TABLE public.store_orders ADD COLUMN dispute_opened_at timestamptz;
  END IF;
END $$;

-- Update store_orders status constraint to include 'disputed'
ALTER TABLE public.store_orders DROP CONSTRAINT IF EXISTS store_orders_status_check;
ALTER TABLE public.store_orders ADD CONSTRAINT store_orders_status_check
  CHECK (status IN ('pending','processing','paid','delivered','completed','cancelled','refunded','disputed'));
