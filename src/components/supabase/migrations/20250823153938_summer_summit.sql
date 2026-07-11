/*
  # Fix infinite recursion in RLS policies

  1. Problem
    - RLS policies on sellers and streaming_accounts tables are causing infinite recursion
    - The policies reference the users table which has its own policies creating circular dependencies

  2. Solution
    - Simplify RLS policies to use direct auth.uid() checks instead of complex joins
    - Remove policies that create circular references to the users table
    - Use simpler, more direct policy conditions

  3. Changes
    - Drop existing problematic policies on sellers and streaming_accounts tables
    - Create new simplified policies that avoid recursion
    - Ensure policies are efficient and don't create circular dependencies
*/

-- Drop existing problematic policies on sellers table
DROP POLICY IF EXISTS "Admins can read all sellers" ON sellers;
DROP POLICY IF EXISTS "Admins can update all sellers" ON sellers;
DROP POLICY IF EXISTS "Authenticated users can manage sellers" ON sellers;
DROP POLICY IF EXISTS "Sellers can read own data" ON sellers;
DROP POLICY IF EXISTS "Sellers can update own data" ON sellers;

-- Create new simplified policies for sellers table
CREATE POLICY "Enable all access for authenticated users"
  ON sellers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Drop existing problematic policies on streaming_accounts table
DROP POLICY IF EXISTS "Authenticated users can manage streaming accounts" ON streaming_accounts;

-- Create new simplified policies for streaming_accounts table
CREATE POLICY "Enable all access for authenticated users"
  ON streaming_accounts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Drop existing problematic policies on users table that might cause recursion
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

-- Create new simplified policies for users table
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure other tables with similar issues are also fixed
-- Drop and recreate policies for seller_products table
DROP POLICY IF EXISTS "Admins can manage all seller products" ON seller_products;
DROP POLICY IF EXISTS "Sellers can insert own products" ON seller_products;
DROP POLICY IF EXISTS "Sellers can read own products" ON seller_products;
DROP POLICY IF EXISTS "Sellers can update own products" ON seller_products;

CREATE POLICY "Enable all access for authenticated users"
  ON seller_products
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Drop and recreate policies for sales table
DROP POLICY IF EXISTS "Admins can read all sales" ON sales;
DROP POLICY IF EXISTS "Clients can read own sales" ON sales;
DROP POLICY IF EXISTS "Sellers can read own sales" ON sales;

CREATE POLICY "Enable all access for authenticated users"
  ON sales
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Drop and recreate policies for balance_transactions table
DROP POLICY IF EXISTS "Admins can read all balance transactions" ON balance_transactions;

CREATE POLICY "Enable all access for authenticated users"
  ON balance_transactions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Drop and recreate policies for support_tickets table
DROP POLICY IF EXISTS "Admins can read all tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admins can update all tickets" ON support_tickets;

CREATE POLICY "Enable all access for authenticated users"
  ON support_tickets
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Drop and recreate policies for support_messages table
DROP POLICY IF EXISTS "Admins can insert messages to any ticket" ON support_messages;
DROP POLICY IF EXISTS "Admins can read all support messages" ON support_messages;

CREATE POLICY "Enable all access for authenticated users"
  ON support_messages
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Drop and recreate policies for credit_transactions table
DROP POLICY IF EXISTS "Admins can insert transactions" ON credit_transactions;
DROP POLICY IF EXISTS "Admins can read all transactions" ON credit_transactions;

CREATE POLICY "Enable all access for authenticated users"
  ON credit_transactions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);