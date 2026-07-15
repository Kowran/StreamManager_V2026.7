import { useState, useEffect, useCallback } from 'react';
import { StoreProduct } from '../lib/supabase';

const STORAGE_KEY = 'recently_viewed_products';
const MAX_ITEMS = 20;

export function useRecentlyViewed() {
  const [recentlyViewed, setRecentlyViewed] = useState<StoreProduct[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecentlyViewed(JSON.parse(stored));
      }
    } catch { /* ignore */ }
  }, []);

  const trackView = useCallback((product: StoreProduct) => {
    setRecentlyViewed(prev => {
      const filtered = prev.filter(p => p.id !== product.id);
      const updated = [product, ...filtered].slice(0, MAX_ITEMS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch { /* ignore */ }
      return updated;
    });
  }, []);

  const getRecentlyViewedProducts = useCallback((allProducts: StoreProduct[]): StoreProduct[] => {
    const ids = recentlyViewed.map(p => p.id);
    return ids
      .map(id => allProducts.find(p => p.id === id))
      .filter((p): p is StoreProduct => p !== undefined);
  }, [recentlyViewed]);

  return { recentlyViewed, trackView, getRecentlyViewedProducts };
}
