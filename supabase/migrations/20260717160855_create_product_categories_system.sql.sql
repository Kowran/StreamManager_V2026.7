/*
# Create product categories system

1. New Tables
- `product_categories` — admin-managed game/product categories (e.g. Clash of Clans, Fortnite, Minecraft)
  - `id` uuid primary key
  - `name` text not null (display name)
  - `slug` text unique not null (URL-safe identifier)
  - `image_url` text (category cover/logo image)
  - `search_keywords` text[] not null default '{}' (keywords used to match seller products)
  - `sort_order` int not null default 0
  - `is_active` boolean not null default true
  - `created_at` timestamptz default now()
  - `updated_at` timestamptz default now()

2. Security
- Enable RLS on `product_categories`.
- SELECT: public (anon, authenticated) — categories are shown to all store visitors.
- INSERT/UPDATE/DELETE: admin only (auth.uid() matches a profile with role = 'admin').

3. Important notes
- The `search_keywords` array is matched against store_products via ILIKE on name/description
  in the frontend, so sellers do not need to tag products explicitly — keywords like
  ['clash of clans','coc','clash'] will surface any seller product whose name/description matches.
- `slug` is used in the URL route `#category/<slug>` for shareable category pages.
*/

CREATE TABLE IF NOT EXISTS product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  image_url text,
  search_keywords text[] NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Public read: categories visible to all store visitors (no-auth app store front)
DROP POLICY IF EXISTS "public_read_product_categories" ON product_categories;
CREATE POLICY "public_read_product_categories"
ON product_categories FOR SELECT
TO anon, authenticated
USING (true);

-- Admin-only writes: check the user's profile role is 'admin'
DROP POLICY IF EXISTS "admin_insert_product_categories" ON product_categories;
CREATE POLICY "admin_insert_product_categories"
ON product_categories FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

DROP POLICY IF EXISTS "admin_update_product_categories" ON product_categories;
CREATE POLICY "admin_update_product_categories"
ON product_categories FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

DROP POLICY IF EXISTS "admin_delete_product_categories" ON product_categories;
CREATE POLICY "admin_delete_product_categories"
ON product_categories FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Index for active categories listing ordered by sort_order
CREATE INDEX IF NOT EXISTS idx_product_categories_active_sort
ON product_categories (is_active, sort_order);
