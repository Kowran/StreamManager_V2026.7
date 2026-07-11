/*
  # Add Seller Slug to Profiles

  1. Changes
    - Add `seller_slug` column to `profiles` table
    - Create unique index on `seller_slug`
    - Add function to automatically generate slug from name
    - Add trigger to update slug when name changes
    
  2. Security
    - Maintain existing RLS policies
    - Allow public read access to seller_slug for public profiles
*/

-- Add seller_slug column
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS seller_slug text;

-- Create function to generate slug from name
CREATE OR REPLACE FUNCTION generate_seller_slug(name text, user_id uuid)
RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  -- Generate base slug: lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  -- If empty, use 'seller'
  IF base_slug = '' THEN
    base_slug := 'seller';
  END IF;
  
  -- Add user ID prefix to ensure uniqueness
  final_slug := base_slug || '-' || substring(user_id::text from 1 for 8);
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Update existing profiles with slugs
UPDATE profiles 
SET seller_slug = generate_seller_slug(
  COALESCE(full_name, 'seller'), 
  id
)
WHERE seller_slug IS NULL;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS profiles_seller_slug_unique 
ON profiles(seller_slug) 
WHERE seller_slug IS NOT NULL;

-- Create trigger function to auto-update slug
CREATE OR REPLACE FUNCTION update_seller_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if name changed and user is seller or admin
  IF (NEW.full_name IS DISTINCT FROM OLD.full_name) AND 
     (NEW.role IN ('seller', 'admin')) THEN
    NEW.seller_slug := generate_seller_slug(NEW.full_name, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_seller_slug ON profiles;
CREATE TRIGGER trigger_update_seller_slug
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_slug();

-- Create trigger for new sellers
CREATE OR REPLACE FUNCTION set_initial_seller_slug()
RETURNS TRIGGER AS $$
BEGIN
  -- Set slug for new sellers/admins
  IF NEW.role IN ('seller', 'admin') AND NEW.seller_slug IS NULL THEN
    NEW.seller_slug := generate_seller_slug(
      COALESCE(NEW.full_name, 'seller'), 
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_initial_seller_slug ON profiles;
CREATE TRIGGER trigger_set_initial_seller_slug
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_initial_seller_slug();