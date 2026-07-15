import React, { useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Package, Truck, Zap } from 'lucide-react';
import { StoreProduct } from '../lib/supabase';
import { useCurrency } from './CurrencyProvider';
import { useLanguage } from './LanguageProvider';

interface ProductRowProps {
  title: string;
  subtitle?: string;
  products: StoreProduct[];
  onProductClick: (product: StoreProduct) => void;
  emptyMessage?: string;
  icon?: React.ReactNode;
}

export function ProductRow({ title, subtitle, products, onProductClick, emptyMessage, icon }: ProductRowProps) {
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
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">{title}</h2>
            {subtitle && <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="p-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="p-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={updateScrollButtons}
        className="flex gap-3 sm:gap-4 overflow-x-auto scroll-smooth pb-2 -mx-1 px-1 snap-x product-row-scroll"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {products.map(product => {
          const available = (product as any).manual_delivery || product.stock_quantity > 0;
          const hasPromo = product.promotion_active && product.promotional_price_usdt;
          return (
            <div
              key={product.id}
              onClick={() => onProductClick(product)}
              className="group relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer border border-gray-200 dark:border-gray-700 hover:-translate-y-1 flex-shrink-0 w-[160px] sm:w-[220px] snap-start"
            >
              <div className="relative aspect-video overflow-hidden bg-gray-100 dark:bg-gray-700">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                  </div>
                )}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-xs font-medium bg-black/50 backdrop-blur-sm text-white capitalize">{product.category}</span>
                {!available && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-xs font-medium bg-red-500/80 backdrop-blur-sm text-white">
                    {t.language === 'pt' ? 'Esgotado' : t.language === 'en' ? 'Sold Out' : 'Agotado'}
                  </span>
                )}
                {available && product.stock_quantity > 0 && product.stock_quantity <= 5 && !(product as any).manual_delivery && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-xs font-medium bg-orange-500/80 backdrop-blur-sm text-white">
                    {t.language === 'pt' ? `Restam ${product.stock_quantity}` : t.language === 'en' ? `${product.stock_quantity} left` : `Quedan ${product.stock_quantity}`}
                  </span>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1 line-clamp-1">{product.name}</h3>
                {(product as any).seller_name && (
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <span className="truncate">{(product as any).seller_name}</span>
                  </div>
                )}
                <div className="mb-1.5 flex items-center gap-1">
                  {(product as any).manual_delivery ? (
                    (product as any).account_recharge ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        <Zap className="h-2.5 w-2.5 mr-0.5" />
                        {t.language === 'pt' ? 'Recarga' : t.language === 'en' ? 'Recharge' : 'Recarga'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        <Truck className="h-2.5 w-2.5 mr-0.5" />
                        {t.language === 'pt' ? 'Manual' : t.language === 'en' ? 'Manual' : 'Manual'}
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      <Zap className="h-2.5 w-2.5 mr-0.5" />
                      {t.language === 'pt' ? 'Automático' : t.language === 'en' ? 'Automatic' : 'Automático'}
                    </span>
                  )}
                </div>
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
