/*
  # Create Affiliate System

  1. New Tables
    - `affiliate_links`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `code` (text, unique affiliate code)
      - `clicks` (integer, total clicks)
      - `conversions` (integer, successful registrations)
      - `total_earned` (numeric, total commissions earned)
      - `active` (boolean, if link is active)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `affiliate_referrals`
      - `id` (uuid, primary key)
      - `referrer_id` (uuid, foreign key to auth.users - who made the invite)
      - `referred_id` (uuid, foreign key to auth.users - who was invited)
      - `affiliate_code` (text, code used for registration)
      - `registration_date` (timestamp)
      - `first_purchase_date` (timestamp, nullable)
      - `total_spent` (numeric, total amount spent by referred user)
      - `total_commission_earned` (numeric, total commission earned from this referral)
      - `active` (boolean, if referral is still active)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `affiliate_commissions`
      - `id` (uuid, primary key)
      - `referrer_id` (uuid, foreign key to auth.users)
      - `referred_id` (uuid, foreign key to auth.users)
      - `transaction_id` (uuid, foreign key to credit_transactions)
      - `recharge_amount` (numeric, original recharge amount)
      - `commission_rate` (numeric, commission percentage - 0.05 for 5%)
      - `commission_amount` (numeric, calculated commission)
      - `status` (text, pending/paid/cancelled)
      - `paid_at` (timestamp, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for users to manage their own affiliate data
    - Add policies for admins to view all affiliate data

  3. Functions
    - Function to generate unique affiliate codes
    - Function to process affiliate commissions
    - Function to track affiliate link clicks
*/

-- Create affiliate_links table
CREATE TABLE IF NOT EXISTS affiliate_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  clicks integer DEFAULT 0,
  conversions integer DEFAULT 0,
  total_earned numeric(10,2) DEFAULT 0.00,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create affiliate_referrals table
CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_code text NOT NULL,
  registration_date timestamptz DEFAULT now(),
  first_purchase_date timestamptz,
  total_spent numeric(10,2) DEFAULT 0.00,
  total_commission_earned numeric(10,2) DEFAULT 0.00,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(referrer_id, referred_id)
);

-- Create affiliate_commissions table
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES credit_transactions(id) ON DELETE CASCADE,
  recharge_amount numeric(10,2) NOT NULL,
  commission_rate numeric(5,4) DEFAULT 0.05,
  commission_amount numeric(10,2) NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_affiliate_links_user_id ON affiliate_links(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_code ON affiliate_links(code);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referrer_id ON affiliate_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referred_id ON affiliate_referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_code ON affiliate_referrals(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_referrer_id ON affiliate_commissions(referrer_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_transaction_id ON affiliate_commissions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_status ON affiliate_commissions(status);

-- Enable RLS
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for affiliate_links
CREATE POLICY "Users can manage own affiliate links"
  ON affiliate_links
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all affiliate links"
  ON affiliate_links
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- RLS Policies for affiliate_referrals
CREATE POLICY "Users can view own referrals"
  ON affiliate_referrals
  FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

CREATE POLICY "System can create referrals"
  ON affiliate_referrals
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own referrals"
  ON affiliate_referrals
  FOR UPDATE
  TO authenticated
  USING (referrer_id = auth.uid())
  WITH CHECK (referrer_id = auth.uid());

CREATE POLICY "Admins can manage all referrals"
  ON affiliate_referrals
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- RLS Policies for affiliate_commissions
CREATE POLICY "Users can view own commissions"
  ON affiliate_commissions
  FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

CREATE POLICY "System can create commissions"
  ON affiliate_commissions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can manage all commissions"
  ON affiliate_commissions
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Function to generate unique affiliate code
CREATE OR REPLACE FUNCTION generate_affiliate_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
  exists_check boolean;
BEGIN
  LOOP
    -- Generate 8-character code with letters and numbers
    code := upper(substring(md5(random()::text) from 1 for 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM affiliate_links WHERE affiliate_links.code = code) INTO exists_check;
    
    -- Exit loop if code is unique
    IF NOT exists_check THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN code;
END;
$$;

-- Function to create affiliate link for new users
CREATE OR REPLACE FUNCTION create_user_affiliate_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create affiliate link for new user
  INSERT INTO affiliate_links (user_id, code)
  VALUES (NEW.id, generate_affiliate_code());
  
  RETURN NEW;
END;
$$;

-- Trigger to create affiliate link when user profile is created
CREATE TRIGGER trigger_create_user_affiliate_link
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_user_affiliate_link();

-- Function to process affiliate commissions
CREATE OR REPLACE FUNCTION process_affiliate_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referral_record affiliate_referrals%ROWTYPE;
  commission_amount numeric(10,2);
  commission_rate numeric(5,4) := 0.05; -- 5%
  referrer_balance numeric(10,2);
BEGIN
  -- Only process for recharge transactions
  IF NEW.type != 'recharge' THEN
    RETURN NEW;
  END IF;

  -- Check if this user was referred by someone
  SELECT * INTO referral_record
  FROM affiliate_referrals
  WHERE referred_id = NEW.user_id AND active = true
  LIMIT 1;

  -- If no referral found, exit
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Calculate commission (5% of recharge amount)
  commission_amount := NEW.amount * commission_rate;

  -- Create commission record
  INSERT INTO affiliate_commissions (
    referrer_id,
    referred_id,
    transaction_id,
    recharge_amount,
    commission_rate,
    commission_amount,
    status
  ) VALUES (
    referral_record.referrer_id,
    referral_record.referred_id,
    NEW.id,
    NEW.amount,
    commission_rate,
    commission_amount,
    'paid'
  );

  -- Add commission to referrer's balance
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    balance_before,
    balance_after,
    description,
    reference_id,
    reference_type,
    metadata
  ) 
  SELECT 
    referral_record.referrer_id,
    'bonus',
    commission_amount,
    COALESCE(uc.balance, 0),
    COALESCE(uc.balance, 0) + commission_amount,
    'Comissão de afiliado - ' || (SELECT email FROM profiles WHERE id = referral_record.referred_id),
    NEW.id,
    'affiliate_commission',
    jsonb_build_object(
      'commission_rate', commission_rate,
      'original_recharge', NEW.amount,
      'referred_user_id', referral_record.referred_id,
      'affiliate_code', referral_record.affiliate_code
    )
  FROM (
    SELECT COALESCE(balance, 0) as balance
    FROM user_credits 
    WHERE user_id = referral_record.referrer_id
  ) uc;

  -- Update referral statistics
  UPDATE affiliate_referrals
  SET 
    total_spent = total_spent + NEW.amount,
    total_commission_earned = total_commission_earned + commission_amount,
    first_purchase_date = COALESCE(first_purchase_date, NEW.created_at),
    updated_at = now()
  WHERE id = referral_record.id;

  -- Update affiliate link statistics
  UPDATE affiliate_links
  SET 
    total_earned = total_earned + commission_amount,
    updated_at = now()
  WHERE user_id = referral_record.referrer_id;

  -- Create notification for referrer
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    priority
  ) VALUES (
    referral_record.referrer_id,
    'admin',
    '💰 Comissão de Afiliado Recebida!',
    'Você recebeu $' || commission_amount::text || ' de comissão por uma recarga do seu indicado!',
    jsonb_build_object(
      'commission_amount', commission_amount,
      'recharge_amount', NEW.amount,
      'referred_user_email', (SELECT email FROM profiles WHERE id = referral_record.referred_id),
      'commission_rate', commission_rate * 100
    ),
    'high'
  );

  RETURN NEW;
END;
$$;

-- Trigger to process affiliate commissions on credit transactions
CREATE TRIGGER trigger_process_affiliate_commission
  AFTER INSERT ON credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION process_affiliate_commission();

-- Function to track affiliate link clicks
CREATE OR REPLACE FUNCTION track_affiliate_click(affiliate_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update click count
  UPDATE affiliate_links
  SET 
    clicks = clicks + 1,
    updated_at = now()
  WHERE code = affiliate_code AND active = true;

  -- Return true if code exists and is active
  RETURN FOUND;
END;
$$;

-- Function to create referral relationship
CREATE OR REPLACE FUNCTION create_affiliate_referral(
  p_affiliate_code text,
  p_referred_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referrer_user_id uuid;
BEGIN
  -- Get referrer user ID from affiliate code
  SELECT user_id INTO referrer_user_id
  FROM affiliate_links
  WHERE code = p_affiliate_code AND active = true;

  -- If code not found or inactive, return false
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Don't allow self-referral
  IF referrer_user_id = p_referred_user_id THEN
    RETURN false;
  END IF;

  -- Create referral relationship
  INSERT INTO affiliate_referrals (
    referrer_id,
    referred_id,
    affiliate_code,
    registration_date
  ) VALUES (
    referrer_user_id,
    p_referred_user_id,
    p_affiliate_code,
    now()
  ) ON CONFLICT (referrer_id, referred_id) DO NOTHING;

  -- Update conversion count
  UPDATE affiliate_links
  SET 
    conversions = conversions + 1,
    updated_at = now()
  WHERE user_id = referrer_user_id;

  -- Create notification for referrer
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    priority
  ) VALUES (
    referrer_user_id,
    'system',
    '🎉 Novo Usuário Indicado!',
    'Parabéns! Um novo usuário se cadastrou usando seu link de afiliado. Você receberá 5% de comissão em todas as recargas dele!',
    jsonb_build_object(
      'referred_user_id', p_referred_user_id,
      'affiliate_code', p_affiliate_code,
      'commission_rate', 5
    ),
    'high'
  );

  RETURN true;
END;
$$;

-- Add affiliate_code column to profiles table for tracking registration source
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'affiliate_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN affiliate_code text;
  END IF;
END $$;

-- Create index for affiliate_code in profiles
CREATE INDEX IF NOT EXISTS idx_profiles_affiliate_code ON profiles(affiliate_code) WHERE affiliate_code IS NOT NULL;