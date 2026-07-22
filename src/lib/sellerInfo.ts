import { supabase } from './supabase';

export interface SellerInfo {
  id: string;
  full_name: string | null;
  seller_slug: string | null;
  username: string | null;
  avatar_url: string | null;
  cover_url?: string | null;
  bio?: string | null;
  theme_color?: string | null;
  profile_badge?: string | null;
  role?: string;
  created_at?: string;
  seller_level?: number | null;
  seller_xp?: number | null;
  user_level?: number | null;
  user_xp?: number | null;
  last_seen_at?: string | null;
  login_count?: number | null;
  last_login_at?: string | null;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callEdgeFunction(body: Record<string, unknown>): Promise<SellerInfo[] | null> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/get-seller-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data as SellerInfo[];
    }
  } catch {
    // fall through
  }
  return null;
}

/**
 * Fetches public seller info for a list of seller IDs.
 * Tries the edge function first (bypasses RLS, works for anon users),
 * falls back to direct profiles query (works for authenticated admin users).
 */
export async function fetchSellerInfo(sellerIds: string[]): Promise<Record<string, SellerInfo>> {
  if (sellerIds.length === 0) return {};

  const map: Record<string, SellerInfo> = {};

  // Try edge function first
  const edgeData = await callEdgeFunction({ seller_ids: sellerIds });
  if (edgeData) {
    for (const s of edgeData) map[s.id] = s;
    return map;
  }

  // Fallback: direct profiles query
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, seller_slug, username, avatar_url')
      .in('id', sellerIds);
    for (const s of data || []) map[s.id] = s as SellerInfo;
  } catch {
    // ignore
  }

  return map;
}

/**
 * Fetches a single seller's info by ID.
 */
export async function fetchSingleSellerInfo(sellerId: string): Promise<SellerInfo | null> {
  const map = await fetchSellerInfo([sellerId]);
  return map[sellerId] || null;
}

/**
 * Fetches a seller's full public profile by slug.
 * Tries edge function first, falls back to direct query.
 */
export async function fetchSellerBySlug(sellerSlug: string): Promise<SellerInfo | null> {
  // Try edge function
  const edgeData = await callEdgeFunction({ seller_slug: sellerSlug });
  if (edgeData && edgeData.length > 0) return edgeData[0];

  // Fallback: direct query
  try {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('seller_slug', sellerSlug)
      .maybeSingle();
    return data as SellerInfo | null;
  } catch {
    return null;
  }
}

/**
 * Fetches admin profile info (for products without a seller_id).
 */
export async function fetchAdminSellerInfo(): Promise<SellerInfo | null> {
  // Try edge function
  const edgeData = await callEdgeFunction({ admin_only: true });
  if (edgeData && edgeData.length > 0) return edgeData[0];

  // Fallback: direct query
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, seller_slug, username, avatar_url')
      .eq('role', 'admin')
      .maybeSingle();
    return data as SellerInfo | null;
  } catch {
    return null;
  }
}
