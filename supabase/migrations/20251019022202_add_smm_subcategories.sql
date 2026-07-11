/*
  # Add SMM Service Subcategories

  1. Changes
    - Add `subcategory` column to smm_services table
    - Simple text-based subcategory field for flexible categorization
  
  2. Features
    - Allows admin to define custom subcategories for each service
    - No additional table needed - keeps it simple
    - Easy to filter and organize services by subcategory
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smm_services' AND column_name = 'subcategory'
  ) THEN
    ALTER TABLE smm_services ADD COLUMN subcategory text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_smm_services_subcategory ON smm_services(subcategory);
