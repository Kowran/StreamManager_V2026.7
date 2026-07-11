/*
  # Add Seller Role to Profiles

  1. Changes
    - Drop existing role check constraint
    - Add new constraint that includes seller role
    - Update existing approved sellers to have seller role

  2. Purpose
    - Fix issue where sellers cannot be created due to constraint violation
    - Allow admin, customer, and seller roles
*/

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'customer', 'seller'));

UPDATE profiles 
SET role = 'seller' 
WHERE id IN (
  SELECT DISTINCT user_id 
  FROM seller_requests 
  WHERE status = 'approved'
);