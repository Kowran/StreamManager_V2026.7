-- Add metadata column to direct_messages for order citations and other structured data
ALTER TABLE public.direct_messages
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT null;
