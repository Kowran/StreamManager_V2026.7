/*
  # Add SMM Service Categories

  1. New Tables
    - `smm_categories` - Categories for SMM services with icon support
      - `id` (uuid, primary key)
      - `name` (text, category name)
      - `icon` (text, icon identifier)
      - `description` (text, optional description)
      - `active` (boolean, visibility toggle)
      - `sort_order` (integer, display order)
      - `created_at` (timestamptz)
  
  2. Changes
    - Add foreign key to smm_services linking to smm_categories
    - Keep backward compatibility with existing category text field
  
  3. Security
    - Enable RLS on smm_categories table
    - Users can view active categories
    - Admins can manage categories
  
  4. Features
    - Admin-defined categories with icons
    - Better organization for SMM services
    - Easy category management
*/

-- Create SMM categories table
CREATE TABLE IF NOT EXISTS smm_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text DEFAULT 'package',
  description text,
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE smm_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for smm_categories
CREATE POLICY "Users can view active categories"
  ON smm_categories
  FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Admins can manage categories"
  ON smm_categories
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Add category_id to smm_services for future use
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smm_services' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE smm_services ADD COLUMN category_id uuid REFERENCES smm_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_smm_services_category_id ON smm_services(category_id);
CREATE INDEX IF NOT EXISTS idx_smm_categories_active ON smm_categories(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_smm_categories_sort_order ON smm_categories(sort_order);

-- Insert default categories
INSERT INTO smm_categories (name, icon, description, sort_order) VALUES
('Instagram', 'instagram', 'Serviços para Instagram', 1),
('Facebook', 'facebook', 'Serviços para Facebook', 2),
('Twitter', 'twitter', 'Serviços para Twitter/X', 3),
('YouTube', 'youtube', 'Serviços para YouTube', 4),
('TikTok', 'music', 'Serviços para TikTok', 5),
('Spotify', 'music', 'Serviços para Spotify', 6),
('Telegram', 'send', 'Serviços para Telegram', 7),
('Outros', 'package', 'Outros serviços de redes sociais', 99)
ON CONFLICT DO NOTHING;
