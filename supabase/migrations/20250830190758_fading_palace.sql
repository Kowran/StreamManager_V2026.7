/*
  # Fix Affiliate System Errors

  1. Database Issues
    - Fix ambiguous column reference in profile creation
    - Add proper foreign key constraints for affiliate tables
    - Update trigger functions to avoid column conflicts

  2. Schema Updates
    - Ensure proper relationships between affiliate tables and profiles
    - Add missing foreign key constraints with correct names
*/

-- First, let's check if the affiliate tables exist and fix foreign key relationships
DO $$
BEGIN
  -- Fix foreign key constraints for affiliate_referrals table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'affiliate_referrals') THEN
    -- Drop existing foreign keys if they exist with wrong names
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'affiliate_referrals_referred_id_fkey' 
               AND table_name = 'affiliate_referrals') THEN
      ALTER TABLE affiliate_referrals DROP CONSTRAINT affiliate_referrals_referred_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'affiliate_referrals_referrer_id_fkey' 
               AND table_name = 'affiliate_referrals') THEN
      ALTER TABLE affiliate_referrals DROP CONSTRAINT affiliate_referrals_referrer_id_fkey;
    END IF;
    
    -- Add correct foreign key constraints
    ALTER TABLE affiliate_referrals 
    ADD CONSTRAINT affiliate_referrals_referred_id_fkey 
    FOREIGN KEY (referred_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    ALTER TABLE affiliate_referrals 
    ADD CONSTRAINT affiliate_referrals_referrer_id_fkey 
    FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  -- Fix foreign key constraints for affiliate_commissions table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'affiliate_commissions') THEN
    -- Drop existing foreign keys if they exist with wrong names
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'affiliate_commissions_referred_id_fkey' 
               AND table_name = 'affiliate_commissions') THEN
      ALTER TABLE affiliate_commissions DROP CONSTRAINT affiliate_commissions_referred_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'affiliate_commissions_referrer_id_fkey' 
               AND table_name = 'affiliate_commissions') THEN
      ALTER TABLE affiliate_commissions DROP CONSTRAINT affiliate_commissions_referrer_id_fkey;
    END IF;
    
    -- Add correct foreign key constraints
    ALTER TABLE affiliate_commissions 
    ADD CONSTRAINT affiliate_commissions_referred_id_fkey 
    FOREIGN KEY (referred_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    
    ALTER TABLE affiliate_commissions 
    ADD CONSTRAINT affiliate_commissions_referrer_id_fkey 
    FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create function to track affiliate clicks
CREATE OR REPLACE FUNCTION track_affiliate_click(affiliate_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update click count for the affiliate link
  UPDATE affiliate_links 
  SET clicks = clicks + 1,
      updated_at = now()
  WHERE code = affiliate_code AND active = true;
  
  -- Return true if a row was updated (valid code)
  RETURN FOUND;
END;
$$;

-- Create function to create affiliate referral
CREATE OR REPLACE FUNCTION create_affiliate_referral(
  p_affiliate_code TEXT,
  p_referred_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  -- Get the referrer user ID from the affiliate code
  SELECT user_id INTO v_referrer_id
  FROM affiliate_links
  WHERE code = p_affiliate_code AND active = true;
  
  -- If no valid affiliate code found, return false
  IF v_referrer_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Prevent self-referral
  IF v_referrer_id = p_referred_user_id THEN
    RETURN FALSE;
  END IF;
  
  -- Check if referral already exists
  IF EXISTS (
    SELECT 1 FROM affiliate_referrals 
    WHERE referred_id = p_referred_user_id
  ) THEN
    RETURN FALSE;
  END IF;
  
  -- Create the referral relationship
  INSERT INTO affiliate_referrals (
    referrer_id,
    referred_id,
    affiliate_code,
    registration_date,
    active
  ) VALUES (
    v_referrer_id,
    p_referred_user_id,
    p_affiliate_code,
    now(),
    true
  );
  
  -- Update conversion count
  UPDATE affiliate_links 
  SET conversions = conversions + 1,
      updated_at = now()
  WHERE user_id = v_referrer_id;
  
  RETURN TRUE;
END;
$$;

-- Update the process_affiliate_commission function to fix column ambiguity
CREATE OR REPLACE FUNCTION process_affiliate_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_id UUID;
  v_commission_rate NUMERIC := 0.05; -- 5%
  v_commission_amount NUMERIC;
BEGIN
  -- Only process recharge transactions
  IF NEW.type != 'recharge' THEN
    RETURN NEW;
  END IF;
  
  -- Find if this user was referred by someone
  SELECT referrer_id INTO v_referrer_id
  FROM affiliate_referrals
  WHERE referred_id = NEW.user_id AND active = true;
  
  -- If no referrer found, nothing to do
  IF v_referrer_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Calculate commission (5% of recharge amount)
  v_commission_amount := NEW.amount * v_commission_rate;
  
  -- Create commission record
  INSERT INTO affiliate_commissions (
    referrer_id,
    referred_id,
    transaction_id,
    recharge_amount,
    commission_rate,
    commission_amount,
    status,
    paid_at
  ) VALUES (
    v_referrer_id,
    NEW.user_id,
    NEW.id,
    NEW.amount,
    v_commission_rate,
    v_commission_amount,
    'paid',
    now()
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
    v_referrer_id,
    'bonus',
    v_commission_amount,
    COALESCE(uc.balance, 0),
    COALESCE(uc.balance, 0) + v_commission_amount,
    'Comissão de afiliado - ' || (
      SELECT email FROM profiles WHERE id = NEW.user_id LIMIT 1
    ),
    NEW.id,
    'affiliate_commission',
    jsonb_build_object(
      'commission_rate', v_commission_rate,
      'original_transaction_id', NEW.id,
      'referred_user_id', NEW.user_id,
      'commission_type', 'recharge_commission'
    )
  FROM (
    SELECT balance FROM user_credits WHERE user_id = v_referrer_id
    UNION ALL
    SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM user_credits WHERE user_id = v_referrer_id)
    LIMIT 1
  ) uc;
  
  -- Update referral statistics
  UPDATE affiliate_referrals
  SET total_spent = total_spent + NEW.amount,
      total_commission_earned = total_commission_earned + v_commission_amount,
      first_purchase_date = COALESCE(first_purchase_date, now()),
      updated_at = now()
  WHERE referrer_id = v_referrer_id AND referred_id = NEW.user_id;
  
  -- Update affiliate link total earned
  UPDATE affiliate_links
  SET total_earned = total_earned + v_commission_amount,
      updated_at = now()
  WHERE user_id = v_referrer_id;
  
  RETURN NEW;
END;
$$;

-- Fix the create_user_affiliate_link function to avoid column ambiguity
CREATE OR REPLACE FUNCTION create_user_affiliate_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_affiliate_code TEXT;
BEGIN
  -- Generate unique affiliate code
  LOOP
    v_affiliate_code := upper(substring(md5(random()::text) from 1 for 8));
    
    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM affiliate_links WHERE code = v_affiliate_code) THEN
      EXIT;
    END IF;
  END LOOP;
  
  -- Create affiliate link for the new user
  INSERT INTO affiliate_links (
    user_id,
    code,
    clicks,
    conversions,
    total_earned,
    active
  ) VALUES (
    NEW.id,
    v_affiliate_code,
    0,
    0,
    0.00,
    true
  );
  
  -- Update the profile with the affiliate code
  UPDATE profiles 
  SET affiliate_code = v_affiliate_code
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;