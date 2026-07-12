/*
# Create Seller Marketplace System

## Overview
Creates the database infrastructure for a complete seller marketplace dashboard:
- Seller store settings (restrictions, policies, vacation mode, auto-delivery config)
- Seller-specific support tickets for customer-to-seller communication

## New Tables

### 1. seller_store_settings
- `id` (uuid, primary key)
- `seller_id` (uuid, references profiles, unique per seller)
- `store_name` (text, display name for the store)
- `store_description` (text, store bio/description)
- `store_logo_url` (text, optional logo)
- `store_banner_url` (text, optional banner image)
- `vacation_mode` (boolean, pauses sales when true)
- `auto_accept_orders` (boolean, auto-confirms paid orders)
- `auto_delivery` (boolean, auto-delivers digital products on payment)
- `min_order_amount` (numeric, minimum order value in USD)
- `max_order_quantity` (integer, max items per order)
- `refund_policy` (text, seller's refund policy)
- `terms_of_service` (text, seller's ToS)
- `estimated_delivery_time` (text, e.g. "Instant", "24h")
- `contact_email` (text, optional public contact)
- `social_links` (jsonb, optional social media links)
- `created_at`, `updated_at` (timestamps)

### 2. seller_support_tickets
- `id` (uuid, primary key)
- `ticket_number` (text, unique human-readable ID)
- `seller_id` (uuid, references profiles - the store owner)
- `customer_id` (uuid, references profiles - the buyer)
- `customer_email` (text, for non-registered buyers)
- `customer_name` (text)
- `product_id` (uuid, optional - related product)
- `order_id` (uuid, optional - related order)
- `subject` (text)
- `message` (text, initial message)
- `status` (text: open, waiting_seller, resolved, closed)
- `priority` (text: low, medium, high)
- `created_at`, `updated_at`, `resolved_at` (timestamps)

### 3. seller_support_messages
- `id` (uuid, primary key)
- `ticket_id` (uuid, references seller_support_tickets)
- `sender_id` (uuid, references profiles)
- `sender_type` (text: customer or seller)
- `message` (text)
- `created_at` (timestamp)

## Security (RLS)
- seller_store_settings: seller can CRUD their own settings; public can read (for storefront display)
- seller_support_tickets: seller and customer can read; seller and customer can insert; seller can update status
- seller_support_messages: participants can read and insert

## Important Notes
1. All tables use RLS with auth.uid() ownership checks
2. seller_store_settings has public SELECT for storefront display but seller-only mutations
3. Support tickets are visible to both the seller and the customer who created them
*/

-- ============================================================
-- 1. seller_store_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS seller_store_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  store_name text DEFAULT '',
  store_description text DEFAULT '',
  store_logo_url text DEFAULT '',
  store_banner_url text DEFAULT '',
  vacation_mode boolean NOT NULL DEFAULT false,
  auto_accept_orders boolean NOT NULL DEFAULT false,
  auto_delivery boolean NOT NULL DEFAULT true,
  min_order_amount numeric NOT NULL DEFAULT 0,
  max_order_quantity integer NOT NULL DEFAULT 10,
  refund_policy text DEFAULT '',
  terms_of_service text DEFAULT '',
  estimated_delivery_time text DEFAULT 'Instant',
  contact_email text DEFAULT '',
  social_links jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE seller_store_settings ENABLE ROW LEVEL SECURITY;

-- Public can read store settings (for storefront display)
DROP POLICY IF EXISTS "Public can read store settings" ON seller_store_settings;
CREATE POLICY "Public can read store settings"
ON seller_store_settings FOR SELECT
TO anon, authenticated USING (true);

-- Seller can insert their own settings
DROP POLICY IF EXISTS "Seller can insert own settings" ON seller_store_settings;
CREATE POLICY "Seller can insert own settings"
ON seller_store_settings FOR INSERT
TO authenticated WITH CHECK (auth.uid() = seller_id);

-- Seller can update their own settings
DROP POLICY IF EXISTS "Seller can update own settings" ON seller_store_settings;
CREATE POLICY "Seller can update own settings"
ON seller_store_settings FOR UPDATE
TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);

-- Seller can delete their own settings
DROP POLICY IF EXISTS "Seller can delete own settings" ON seller_store_settings;
CREATE POLICY "Seller can delete own settings"
ON seller_store_settings FOR DELETE
TO authenticated USING (auth.uid() = seller_id);

-- ============================================================
-- 2. seller_support_tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS seller_support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE NOT NULL,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  customer_email text DEFAULT '',
  customer_name text DEFAULT '',
  product_id uuid REFERENCES store_products(id) ON DELETE SET NULL,
  order_id uuid,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting_seller', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE seller_support_tickets ENABLE ROW LEVEL SECURITY;

-- Seller and customer can read tickets
DROP POLICY IF EXISTS "Seller can read own tickets" ON seller_support_tickets;
CREATE POLICY "Seller can read own tickets"
ON seller_support_tickets FOR SELECT
TO authenticated USING (auth.uid() = seller_id OR auth.uid() = customer_id);

-- Authenticated users can insert tickets (customer creates ticket to seller)
DROP POLICY IF EXISTS "Users can insert tickets" ON seller_support_tickets;
CREATE POLICY "Users can insert tickets"
ON seller_support_tickets FOR INSERT
TO authenticated WITH CHECK (auth.uid() = seller_id OR auth.uid() = customer_id OR customer_id IS NULL);

-- Seller can update ticket status
DROP POLICY IF EXISTS "Seller can update tickets" ON seller_support_tickets;
CREATE POLICY "Seller can update tickets"
ON seller_support_tickets FOR UPDATE
TO authenticated USING (auth.uid() = seller_id OR auth.uid() = customer_id) WITH CHECK (auth.uid() = seller_id OR auth.uid() = customer_id);

-- ============================================================
-- 3. seller_support_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS seller_support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES seller_support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('customer', 'seller')),
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE seller_support_messages ENABLE ROW LEVEL SECURITY;

-- Participants can read messages
DROP POLICY IF EXISTS "Participants can read messages" ON seller_support_messages;
CREATE POLICY "Participants can read messages"
ON seller_support_messages FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM seller_support_tickets
    WHERE seller_support_tickets.id = seller_support_messages.ticket_id
    AND (seller_support_tickets.seller_id = auth.uid() OR seller_support_tickets.customer_id = auth.uid())
  )
);

-- Participants can insert messages
DROP POLICY IF EXISTS "Participants can insert messages" ON seller_support_messages;
CREATE POLICY "Participants can insert messages"
ON seller_support_messages FOR INSERT
TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM seller_support_tickets
    WHERE seller_support_tickets.id = seller_support_messages.ticket_id
    AND (seller_support_tickets.seller_id = auth.uid() OR seller_support_tickets.customer_id = auth.uid())
  )
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_seller_store_settings_seller ON seller_store_settings(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_support_tickets_seller ON seller_support_tickets(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_support_tickets_customer ON seller_support_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_seller_support_tickets_status ON seller_support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_seller_support_messages_ticket ON seller_support_messages(ticket_id);

-- ============================================================
-- Auto-generate ticket numbers
-- ============================================================
CREATE OR REPLACE FUNCTION generate_seller_ticket_number()
RETURNS text AS $$
DECLARE
  seq_val integer;
  ticket_num text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 3) AS integer)), 0) + 1
  INTO seq_val
  FROM seller_support_tickets
  WHERE ticket_number LIKE 'ST%';

  ticket_num := 'ST' || lpad(seq_val::text, 6, '0');
  RETURN ticket_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
