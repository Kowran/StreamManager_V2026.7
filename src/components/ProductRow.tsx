import React, { useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { supabase, StoreProduct } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { StandardProductCard, StandardProductData } from './StandardProductCard';

interface SellerInfo {
  business_name: string;
  sales_count: number;
  total_sales?: number;
  seller_slug?: string;
  avatar_url?: string | null;
  average_rating?: number;
  rating_count?: number;
}

interface ProductWithSellerInfo extends StoreProduct {
  seller_info?: SellerInfo;
  sales_count?: number;
  has_variations?: boolean;
  min_variation_price?: number;
}

interface ProductRowProps {
  title: string;
  subtitle?: string;
  products: ProductWithSellerInfo[];
  onProductClick: (product: StoreProduct) => void;
  onAddToCart?: (product: StandardProductData) => void;
  onViewSellerProfile?: (sellerId: string | null, sellerSlug?: string) => void;
  emptyMessage?: string;
  icon?: React.ReactNode;
  onViewAll?: () => void;
}

export function ProductRow({ title, subtitle, products, onProductClick, onAddToCart, onViewSellerProfile, emptyMessage, icon, onViewAll }: ProductRowProps) {
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.8;
    el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  }, []);

  React.useEffect(() => {
    updateScrollButtons();
  }, [products, updateScrollButtons]);

  if (products.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4 px-1 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon}
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors whitespace-nowrap"
            >
              {t.language === 'pt' ? 'Ver tudo' : t.language === 'en' ? 'See all' : 'Ver todo'}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="p-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="p-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={updateScrollButtons}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-2 -mx-1 px-1 snap-x product-row-scroll"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {products.map(product => (
          <StandardProductCard
            key={product.id}
            product={product}
            onCardClick={onProductClick}
            onAddToCart={onAddToCart}
            onViewSellerProfile={onViewSellerProfile}
            widthClass="w-[200px] sm:w-[250px] flex-shrink-0 snap-start"
          />
        ))}
      </div>
    </div>
  );
}
