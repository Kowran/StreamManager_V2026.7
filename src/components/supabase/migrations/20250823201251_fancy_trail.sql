/*
  # Add missing columns to product_stock_lines table

  1. Schema Changes
    - Add `email` column (text, not null)
    - Add `password` column (text, not null) 
    - Add `instructions` column (text, nullable)

  2. Data Migration
    - Parse existing `content` field to populate email and password
    - Set default instructions for existing records

  3. Security
    - Maintain existing RLS policies
*/

-- Add the missing columns to product_stock_lines table
DO $$
BEGIN
  -- Add email column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_stock_lines' AND column_name = 'email'
  ) THEN
    ALTER TABLE product_stock_lines ADD COLUMN email text;
  END IF;

  -- Add password column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_stock_lines' AND column_name = 'password'
  ) THEN
    ALTER TABLE product_stock_lines ADD COLUMN password text;
  END IF;

  -- Add instructions column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_stock_lines' AND column_name = 'instructions'
  ) THEN
    ALTER TABLE product_stock_lines ADD COLUMN instructions text;
  END IF;
END $$;

-- Migrate existing data from content field to new columns
UPDATE product_stock_lines 
SET 
  email = CASE 
    WHEN content LIKE '%:%' THEN split_part(content, ':', 1)
    ELSE content
  END,
  password = CASE 
    WHEN content LIKE '%:%' THEN split_part(content, ':', 2)
    ELSE 'password123'
  END,
  instructions = 'Use estas credenciais para acessar sua conta.'
WHERE email IS NULL OR password IS NULL;

-- Make email and password required (not null) after data migration
ALTER TABLE product_stock_lines 
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN password SET NOT NULL;

-- Set default value for instructions
ALTER TABLE product_stock_lines 
  ALTER COLUMN instructions SET DEFAULT 'Use estas credenciais para acessar sua conta.';