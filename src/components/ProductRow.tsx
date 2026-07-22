import React, { useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Package, Truck, Zap, Star, Store, ArrowRight, TrendingUp, BadgeCheck, Clock } from 'lucide-react';
import { StoreProduct } from '../lib/supabase';

interface SellerInfo {
  business_name: string;
  sales_count: number;
  seller_slug?: string;
  avatar_url?: string | null;
  average_rating?: number;
  rating_count?: number;
}

interface ProductWithSellerInfo extends StoreProduct {
  seller_info?: SellerInfo;
  sales_count?: number;
}
import { useCurrency } from './CurrencyProvider';
import { useLanguage } from './LanguageProvider';

interface ProductRowProps {
  title: string;
  subtitle?: string;
  products: ProductWithSellerInfo[];
  onProductClick: (product: StoreProduct) => void;
  emptyMessage?: string;
  icon?: React.ReactNode;
  onViewAll?: () => void;
}

export function ProductRow({ title, subtitle, products, onProductClick, emptyMessage, icon, onViewAll }: ProductRowProps & { products: ProductWithSellerInfo[] }) {
  const { formatPrice } = useCurrency();
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
        {products.map(product => {
          const available = (product as any).manual_delivery || product.stock_quantity > 0;
          const hasPromo = product.promotion_active && product.promotional_price_usdt;
          const sellerName = product.seller_info?.business_name;
          const sellerAvatar = product.seller_info?.avatar_url;
          const sellerRating = product.seller_info?.average_rating || 0;
          const sellerRatingCount = product.seller_info?.rating_count || 0;
          const salesCount = product.seller_info?.sales_count || (product as any).sales_count || 0;
          const discountPct = hasPromo
            ? Math.round((1 - Number(product.promotional_price_usdt) / Number(product.price_usdt)) * 100)
            : 0;
          return (
            <div
              key={product.id}
              onClick={() => onProductClick(product)}
              className="group relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer border border-gray-200 dark:border-gray-700 hover:-translate-y-1.5 flex-shrink-0 w-[200px] sm:w-[250px] snap-start"
            >
              {/* Image */}
              <div className="relative aspect-[16/11] overflow-hidden bg-gray-100 dark:bg-gray-700">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800">
                    <Package className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                  </div>
                )}
                {/* Top row badges */}
                <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/55 backdrop-blur-sm text-white capitalize">
                    {product.category}
                  </span>
                  {hasPromo && discountPct > 0 && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500 text-white shadow-sm">
                      -{discountPct}%
                    </span>
                  )}
                </div>
                {/* Bottom-left availability / stock */}
                <div className="absolute bottom-2 left-2 flex flex-col gap-1">
                  {!available ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-500/90 backdrop-blur-sm text-white">
                      {t.language === 'pt' ? 'Esgotado' : t.language === 'en' ? 'Sold Out' : 'Agotado'}
                    </span>
                  ) : (
                    <>
                      {product.stock_quantity > 0 && product.stock_quantity <= 5 && !(product as any).manual_delivery && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-orange-500/90 backdrop-blur-sm text-white">
                          {t.language === 'pt' ? `Restam ${product.stock_quantity}` : t.language === 'en' ? `${product.stock_quantity} left` : `Quedan ${product.stock_quantity}`}
                        </span>
                      )}
                      {salesCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/90 backdrop-blur-sm text-white">
                          <TrendingUp className="h-2.5 w-2.5" />
                          {salesCount} {t.language === 'pt' ? 'vendidos' : t.language === 'en' ? 'sold' : 'vendidos'}
                        </span>
                      )}
                    </>
                  )}
                </div>
                {/* Delivery type bottom-right */}
                <div className="absolute bottom-2 right-2">
                  {(product as any).manual_delivery ? (
                    (product as any).account_recharge ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/90 backdrop-blur-sm text-white">
                        <Zap className="h-2.5 w-2.5" />
                        {t.language === 'pt' ? 'Recarga' : t.language === 'en' ? 'Recharge' : 'Recarga'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/90 backdrop-blur-sm text-white">
                        <Truck className="h-2.5 w-2.5" />
                        {t.language === 'pt' ? 'Manual' : t.language === 'en' ? 'Manual' : 'Manual'}
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/90 backdrop-blur-sm text-white">
                      <Zap className="h-2.5 w-2.5" />
                      {t.language === 'pt' ? 'Automático' : t.language === 'en' ? 'Automatic' : 'Automático'}
                    </span>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-3.5">
                <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1.5 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {product.name}
                </h3>

                {/* Seller info */}
                {sellerName && (
                  <div className="mb-2.5 flex items-center gap-1.5">
                    {sellerAvatar ? (
                      <img src={sellerAvatar} alt={sellerName} className="h-4 w-4 rounded-full object-cover flex-shrink-0 ring-1 ring-gray-200 dark:ring-gray-600" />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                        <Store className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">{sellerName}</span>
                    {sellerRatingCount > 0 && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{sellerRating.toFixed(1)}</span>
                        <span className="text-[9px] text-gray-400">({sellerRatingCount})</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Product rating */}
                {(product as any).rating_count > 0 && (product as any).average_rating > 0 && (
                  <div className="mb-2 flex items-center gap-1">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${i < Math.round((product as any).average_rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{(product as any).average_rating.toFixed(1)}</span>
                    <span className="text-[9px] text-gray-400">({(product as any).rating_count})</span>
                  </div>
                )}

                {/* Price */}
                <div className="flex items-baseline gap-2">
                  {hasPromo ? (
                    <>
                      <span className="text-base sm:text-lg font-bold text-red-500">{formatPrice(Number(product.promotional_price_usdt))}</span>
                      <span className="text-xs text-gray-400 line-through">{formatPrice(Number(product.price_usdt))}</span>
                    </>
                  ) : (
                    <span className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{formatPrice(Number(product.price_usdt))}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
