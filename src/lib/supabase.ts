import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Do NOT refresh token or refetch on window focus/visibility — only refresh on explicit user action
    flowType: 'pkce',
  },
  realtime: {
    params: { eventsPerSecond: 2 },
  },
});

// Function to ensure user setup is complete
export async function ensureUserSetup(userId: string, email: string): Promise<boolean> {
  try {
    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!existingProfile) {
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          full_name: null,
          role: 'customer',
          language: 'pt',
          approved: true,
          affiliate_code: null
        });

      if (profileError && !profileError.message.includes('duplicate key')) {
        console.error('Error creating profile:', profileError);
        return false;
      }
    }

    // Ensure user has credit record
    const { data: existingCredit } = await supabase
      .from('user_credits')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingCredit) {
      // Create user credit record
      const { error: creditError } = await supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          balance: 0.00,
          total_recharged: 0.00,
          total_spent: 0.00
        });

      if (creditError && !creditError.message.includes('duplicate key')) {
        console.error('Error creating user credit:', creditError);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error ensuring user setup:', error);
    return false;
  }
}

export type PrimaryCategory = 'account' | 'item' | 'mobile_recharge' | 'game' | 'gift_card' | 'top_up';

export const PRIMARY_CATEGORIES: { key: PrimaryCategory; label: string; icon: string }[] = [
  { key: 'account', label: 'Conta', icon: 'UserCheck' },
  { key: 'item', label: 'Item', icon: 'Package' },
  { key: 'mobile_recharge', label: 'Recarga de Celular', icon: 'Smartphone' },
  { key: 'game', label: 'Jogo', icon: 'Gamepad2' },
  { key: 'gift_card', label: 'Gift Card', icon: 'Gift' },
  { key: 'top_up', label: 'Top-Up', icon: 'Coins' },
];

export interface StoreProduct {
  id: string;
  name: string;
  description?: string;
  price_brl: number; // Keep for backward compatibility
  price_usdt: number;
  category: string;
  primary_category?: PrimaryCategory;
  image_url?: string;
  stock_quantity: number;
  auto_delivery: boolean;
  active: boolean;
  features?: string[];
  renewable?: boolean;
  manual_delivery?: boolean;
  promotional_price_usdt?: number | null;
  promotion_active?: boolean;
  promotion_end_date?: string | null;
  slug?: string;
  seller_id?: string | null;
  account_recharge?: boolean;
  delivery_time?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductVariation {
  id: string;
  product_id: string;
  seller_id?: string | null;
  name: string;
  description?: string;
  price_usdt: number;
  price_brl: number;
  stock_quantity: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductWithSeller extends StoreProduct {
  seller_info?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  is_seller_product?: boolean;
  seller_application_id?: string;
}

export interface StreamingService {
  id: string;
  name: string;
  max_profiles: number;
  monthly_price: number;
  logo_url?: string;
  active: boolean;
}

export interface Seller {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  active: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  created_at: string;
}

export interface StreamingAccount {
  id: string;
  service_id: string;
  seller_id?: string;
  email: string;
  password: string;
  purchase_date: string;
  expiry_date?: string;
  total_profiles: number;
  used_profiles: number;
  monthly_price: number;
  status: 'active' | 'expired' | 'suspended';
  notes?: string;
  created_at: string;
  user_id?: string;
  streaming_services?: StreamingService;
  sellers?: Seller;
}

export interface AccountProfile {
  id: string;
  account_id: string;
  client_id?: string;
  profile_name: string;
  assigned_date: string;
  price_paid: number;
  status: 'active' | 'inactive';
  expiry_date?: string;
  created_at: string;
  clients?: Client;
  streaming_accounts?: StreamingAccount;
}

export interface AccountsAccessPurchase {
  id: string;
  user_id: string;
  order_id?: string;
  access_type: string;
  purchased_at: string;
  expires_at: string;
  duration_days: number;
  price_paid: number;
  active: boolean;
  auto_renew: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductRating {
  id: string;
  user_id: string;
  product_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    email: string;
    full_name?: string;
  };
}

export interface ProductRatingSummary {
  id: string;
  name: string;
  category: string;
  price_usdt: number;
  active: boolean;
  average_rating: number;
  total_ratings: number;
  five_star_count: number;
  four_star_count: number;
  three_star_count: number;
  two_star_count: number;
  one_star_count: number;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  image_url?: string | null;
  search_keywords: string[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Function to check if user has accounts access
export async function hasAccountsAccess(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('accounts_access_purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('active', true)
      .gt('expires_at', new Date().toISOString())
      .limit(1);

    if (error) {
      console.error('Error checking accounts access:', error);
      return false;
    }

    return (data && data.length > 0) || false;
  } catch (error) {
    console.error('Error checking accounts access:', error);
    return false;
  }
}

// Function to get user's accounts access info
export async function getUserAccountsAccess(userId: string): Promise<AccountsAccessPurchase | null> {
  try {
    const { data, error } = await supabase
      .from('accounts_access_purchases')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      console.error('Error getting accounts access:', error);
      return null;
    }

    return data;
  } catch (error: any) {
    console.error('Error getting accounts access:', error);
    return null;
  }
}