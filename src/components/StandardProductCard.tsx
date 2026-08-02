import React from 'react';
import { Star, ShoppingCart, TrendingUp, Store as StoreIcon, Plus } from 'lucide-react';
import { StoreProduct } from '../lib/supabase';
import { useCurrency } from './CurrencyProvider';
import { useLanguage } from './LanguageProvider';
import ProductImage from './ProductImage';

export interface StandardSellerInfo {
  business_name: string;
  sales_count: number;
  total_sales?: number;
  seller_slug?: string;
  avatar_url?: string | null;
  average_rating?: number;
  rating_count?: number;
}

export interface StandardProductData extends StoreProduct {
  seller_info?: StandardSellerInfo;
  sales_count?: number;
  has_variations?: boolean;
  min_variation_price?: number;
}

export interface StandardProductCardProps {
  product: StandardProductData;
  onCardClick: (product: StoreProduct) => void;
  onAddToCart?: (product: StandardProductData) => void;
  onPurchase?: (product: StandardProductData) => void;
  onViewSellerProfile?: (sellerId: string | null, sellerSlug?: string) => void;
  widthClass?: string;
}

export function StandardProductCard({
  product,
  onCardClick,
  onAddToCart,
  onPurchase,
  onViewSellerProfile,
  widthClass = '',
}: StandardProductCardProps) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();

  const sellerName = product.seller_info?.business_name || (product as any).seller_name;
  const sellerAvatar = product.seller_info?.avatar_url || (product as any).seller_avatar;
  const salesCount = product.seller_info?.sales_count || (product as any).sales_count || 0;
  const productRating = (product as any).average_rating || product.seller_info?.average_rating || (product as any).seller_rating || 0;
  const productRatingCount = (product as any).rating_count || product.seller_info?.rating_count || (product as any).seller_rating_count || 0;
  const hasVariations = !!(product as any).has_variations;
  const minVariationPrice = (product as any).min_variation_price;
  const hasPromo = product.promotion_active && product.promotional_price_usdt;
  const isAvailable = product.manual_delivery || (product as any).account_recharge || product.stock_quantity > 0;

  const displayPrice = hasPromo
    ? Number(product.promotional_price_usdt)
    : hasVariations && minVariationPrice != null
      ? Number(minVariationPrice)
      : Number(product.price_usdt);

  const soldLabel = t.language === 'pt' ? 'vendidos' : t.language === 'en' ? 'sold' : 'vendidos';
  const fromLabel = t.language === 'pt' ? 'a partir de' : t.language === 'en' ? 'from' : 'desde';
  const buyLabel = t.language === 'pt' ? 'Comprar' : t.language === 'en' ? 'Buy' : 'Comprar';
  const soldOutLabel = t.language === 'pt' ? 'Esgotado' : t.language === 'en' ? 'Sold Out' : 'Agotado';

  return (
    <div
      onClick={() => onCardClick(product)}
      className={`group relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer border border-gray-200 dark:border-gray-700 hover:-translate-y-1.5 min-w-0 ${!isAvailable ? 'opacity-75' : ''} ${widthClass}`}
    >
      {/* Product Image */}
      <div className="relative">
        <ProductImage
          src={product.image_url}
          alt={product.name}
          hoverScale
          grayscale={!isAvailable}
          rounded="rounded-none"
          className="rounded-none ring-0"
        />
        {!isAvailable && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-500/80 backdrop-blur-sm text-white">
              {soldOutLabel}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 sm:p-3.5">
        {/* Product name */}
        <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1.5 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {product.name}
        </h3>

        {/* Seller info */}
        {sellerName && (
          <div className="mb-1.5 flex items-center gap-1.5 min-w-0">
            {sellerAvatar ? (
              <img
                src={sellerAvatar}
                alt={sellerName}
                className="h-4 w-4 sm:h-5 sm:w-5 rounded-full object-cover flex-shrink-0 ring-1 ring-gray-200 dark:ring-gray-600"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center flex-shrink-0">
                <StoreIcon className="h-2.5 w-2.5 text-white" />
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewSellerProfile?.(product.seller_id || null, product.seller_info?.seller_slug);
              }}
              className="text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:underline font-medium truncate max-w-[140px]"
            >
              {sellerName}
            </button>
          </div>
        )}

        {/* Sold count */}
        {salesCount > 0 && (
          <div className="mb-1.5 flex items-center gap-1 text-[10px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <TrendingUp className="h-3 w-3" />
            <span>{salesCount} {soldLabel}</span>
          </div>
        )}

        {/* Rating */}
        <div className="mb-2 flex items-center gap-1">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${
                  productRatingCount > 0 && i < Math.round(productRating)
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-gray-300 dark:text-gray-600'
                }`}
              />
            ))}
          </div>
          {productRatingCount > 0 && (
            <>
              <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                {productRating.toFixed(1)}
              </span>
              <span className="text-[9px] text-gray-400">({productRatingCount})</span>
            </>
          )}
        </div>

        {/* Price */}
        <div className="mb-2.5 flex items-baseline gap-1.5 sm:gap-2">
          {hasVariations && (
            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">
              {fromLabel}
            </span>
          )}
          {hasPromo && (
            <span className="text-xs text-gray-400 line-through">
              {formatPrice(Number(product.price_usdt))}
            </span>
          )}
          <span className={`text-base sm:text-lg font-bold ${hasPromo ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
            {formatPrice(displayPrice)}
          </span>
        </div>

        {/* Action buttons: Comprar + mini cart */}
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPurchase?.(product);
            }}
            disabled={!isAvailable}
            className={`flex-1 px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold ${
              isAvailable
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            <span>{isAvailable ? buyLabel : soldOutLabel}</span>
          </button>
          {isAvailable && onAddToCart && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart?.(product);
              }}
              title={t.language === 'pt' ? 'Adicionar ao carrinho' : t.language === 'en' ? 'Add to cart' : 'Añadir al carrito'}
              className="px-2.5 py-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-all flex items-center justify-center flex-shrink-0"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}