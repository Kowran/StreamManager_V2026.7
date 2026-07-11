/*
  # Add category column to support_tickets table

  1. Changes
    - Add `category` column to `support_tickets` table
    - Set default value to handle existing records
    - Add check constraint for valid category values

  2. Security
    - No changes to RLS policies needed
    - Existing policies will continue to work
*/

-- Add category column to support_tickets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'category'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN category text DEFAULT 'other';
  END IF;
END $$;

-- Add check constraint for valid category values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'support_tickets_category_check'
  ) THEN
    ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_category_check 
    CHECK (category = ANY (ARRAY[
      'login_issue'::text, 
      'invalid_credentials'::text, 
      'account_suspended'::text, 
      'missing_features'::text, 
      'slow_performance'::text, 
      'billing_issue'::text, 
      'refund_request'::text, 
      'other'::text
    ]));
  END IF;
END $$;