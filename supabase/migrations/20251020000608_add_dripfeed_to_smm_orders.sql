/*
  # Add Dripfeed Support to SMM Orders

  1. Changes
    - Add `dripfeed` column to track if dripfeed is enabled
    - Add `dripfeed_runs` column to store number of runs
    - Add `dripfeed_interval` column to store interval in minutes between runs
    
  2. Notes
    - Dripfeed allows orders to be split into multiple smaller orders over time
    - For example: 10,000 followers delivered in 10 runs of 1,000 every 60 minutes
    - These fields are only used when the service supports dripfeed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smm_orders' AND column_name = 'dripfeed'
  ) THEN
    ALTER TABLE smm_orders ADD COLUMN dripfeed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smm_orders' AND column_name = 'dripfeed_runs'
  ) THEN
    ALTER TABLE smm_orders ADD COLUMN dripfeed_runs integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'smm_orders' AND column_name = 'dripfeed_interval'
  ) THEN
    ALTER TABLE smm_orders ADD COLUMN dripfeed_interval integer;
  END IF;
END $$;