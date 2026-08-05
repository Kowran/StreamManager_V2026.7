import React, { useState, useEffect, useMemo } from 'react';
import { Star, Package, ShoppingBag, TrendingUp, User, Zap, Truck, ChevronRight, Sparkles } from 'lucide-react';
import ProductImage from './ProductImage';
import { supabase } from '../lib/supabase';
import { fetchSellerInfo } from '../lib/sellerInfo';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { ProductRatingsDisplay } from './ProductRatingsDisplay';
import { SellerReputation } from './SellerReputation';
import { navigateToUserProfile } from '../lib/userProfile';

interface SellerProduct {
  id: string;
  name: string;
  description: string;
  price_usdt: number;
  promotional_price_usdt?: number | null;
  promotion_active?: boolean;
  image_url?: string;
  category: string;
  primary_category?: string;
  active: boolean;
  stock_quantity: number;
  manual_delivery?: boolean;
  account_recharge?: boolean;
  delivery_time?: string;
  slug?: string;
  is_featured?: boolean;
}

interface ProductRating {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  buyer_name: string;
  buyer_user_id: string | null;
  buyer_avatar: string | null;
  product_name: string;
}

interface UserRating {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  rater_name: string;
  rater_id: string | null;
  rater_avatar: string | null;
  rater_role: string;
}

interface SellerStats {
  total_sales: number;
  active_products: number;
  average_rating: number;
  total_reviews: number;
  member_since_days: number;
}

interface PublicProfileTabsProps {
  profileId: string;
  profileCreatedAt: string;
  isSeller: boolean;
  themeColor: string;
  onProductClick?: (product: SellerProduct) => void;
}

type TabId = 'products' | 'reviews' | 'seller-reviews' | 'customer-reviews';

export function PublicProfileTabs({
  profileId,
  profileCreatedAt,
  isSeller,
  themeColor,
  onProductClick,
}: PublicProfileTabsProps) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();

  const [stats, setStats] = useState<SellerStats | null>(null);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [ratings, setRatings] = useState<ProductRating[]>([]);
  const [userRatingsAsSeller, setUserRatingsAsSeller] = useState<UserRating[]>([]);
  const [userRatingsAsCustomer, setUserRatingsAsCustomer] = useState<UserRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>(isSeller ? 'products' : 'seller-reviews');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (isSeller) {
      loadSellerContent(profileId);
    } else {
      loadUserRatings(profileId);
    }
  }, [profileId, isSeller]);

  async function loadSellerContent(sellerId: string) {
    setLoading(true);
    try {
      await Promise.all([
        loadSellerStats(sellerId),
        loadSellerProducts(sellerId),
        loadSellerRatings(sellerId),
        loadUserRatings(sellerId),
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function loadSellerStats(sellerId: string) {
    try {
      const { data: salesCountData } = await supabase
        .rpc('get_seller_sales_count', { seller_uuid: sellerId });
      const totalSales = Number(salesCountData) || 0;

      const { count: activeProducts } = await supabase
        .from('store_products')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', sellerId)
        .eq('active', true);

      const { data: ratingsData } = await supabase
        .from('product_ratings')
        .select('rating, store_products!inner(seller_id)')
        .eq('store_products.seller_id', sellerId);

      const avgRating = ratingsData && ratingsData.length > 0
        ? ratingsData.reduce((sum: number, r: any) => sum + r.rating, 0) / ratingsData.length
        : 0;

      const memberSince = profileCreatedAt
        ? Math.floor((Date.now() - new Date(profileCreatedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      setStats({
        total_sales: totalSales,
        active_products: activeProducts || 0,
        average_rating: avgRating,
        total_reviews: ratingsData?.length || 0,
        member_since_days: memberSince,
      });
    } catch (error) {
      console.error('Error in loadSellerStats:', error);
    }
  }

  async function loadSellerProducts(sellerId: string) {
    try {
      const { data, error } = await supabase
        .from('store_products')
        .select('*')
        .eq('seller_id', sellerId)
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error in loadSellerProducts:', error);
    }
  }

  async function loadSellerRatings(sellerId: string) {
    try {
      const { data: ratingsWithDetails, error } = await supabase
        .from('product_ratings')
        .select(`*, store_products!inner(name, seller_id)`)
        .eq('store_products.seller_id', sellerId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;

      if (ratingsWithDetails && ratingsWithDetails.length > 0) {
        const userIds = [...new Set(ratingsWithDetails.map((r: any) => r.user_id))] as string[];
        const profilesMap = await fetchSellerInfo(userIds);
        const profileMap = new Map(Object.entries(profilesMap).map(([id, s]) => [id, s]));

        setRatings(ratingsWithDetails.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment || '',
          created_at: r.created_at,
          buyer_name: profileMap.get(r.user_id)?.username || profileMap.get(r.user_id)?.full_name || 'Anonymous',
          buyer_user_id: r.user_id || null,
          buyer_avatar: profileMap.get(r.user_id)?.avatar_url || null,
          product_name: r.store_products?.name || '',
        })));
      } else {
        setRatings([]);
      }
    } catch (error) {
      console.error('Error in loadSellerRatings:', error);
    }
  }

  async function loadUserRatings(userId: string) {
    try {
      const { data: sellerRatings } = await supabase
        .from('user_ratings')
        .select('id, rating, comment, created_at, rater_role, rater_id')
        .eq('rated_user_id', userId)
        .eq('rater_role', 'customer')
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: customerRatings } = await supabase
        .from('user_ratings')
        .select('id, rating, comment, created_at, rater_role, rater_id')
        .eq('rated_user_id', userId)
        .eq('rater_role', 'seller')
        .order('created_at', { ascending: false })
        .limit(20);

      const allRaterIds = [...new Set([...(sellerRatings || []), ...(customerRatings || [])].map(r => r.rater_id))] as string[];
      let profileMap = new Map<string, any>();
      if (allRaterIds.length > 0) {
        const profilesMap = await fetchSellerInfo(allRaterIds);
        profileMap = new Map(Object.entries(profilesMap));
      }

      if (sellerRatings) {
        setUserRatingsAsSeller(sellerRatings.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment || '',
          created_at: r.created_at,
          rater_name: profileMap.get(r.rater_id)?.username || profileMap.get(r.rater_id)?.full_name || 'Anonymous',
          rater_id: r.rater_id || null,
          rater_avatar: profileMap.get(r.rater_id)?.avatar_url || null,
          rater_role: r.rater_role,
        })));
      }

      if (customerRatings) {
        setUserRatingsAsCustomer(customerRatings.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment || '',
          created_at: r.created_at,
          rater_name: profileMap.get(r.rater_id)?.username || profileMap.get(r.rater_id)?.full_name || 'Anonymous',
          rater_id: r.rater_id || null,
          rater_avatar: profileMap.get(r.rater_id)?.avatar_url || null,
          rater_role: r.rater_role,
        })));
      }
    } catch (error) {
      console.error('Error in loadUserRatings:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString(
      t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES',
      { year: 'numeric', month: 'short', day: 'numeric' }
    );
  }

  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => { if (p.category) cats.add(p.category); });
    return ['all', ...Array.from(cats)];
  }, [products]);

  const PRODUCTS_PER_PAGE = 4;

  const filteredProducts = useMemo(() => {
    if (productFilter === 'all') return products;
    return products.filter(p => p.category === productFilter);
  }, [products, productFilter]);

  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE
  );

  const ratingDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    ratings.forEach(r => { if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++; });
    return dist;
  }, [ratings]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: typeof Package; count: number }[] = isSeller
    ? [
        { id: 'products', label: t.language === 'pt' ? 'Produtos' : t.language === 'en' ? 'Products' : 'Productos', icon: Package, count: products.length },
        { id: 'reviews', label: t.language === 'pt' ? 'Avaliações de Produtos' : t.language === 'en' ? 'Product Reviews' : 'Reseñas de Productos', icon: Star, count: ratings.length },
        { id: 'seller-reviews', label: t.language === 'pt' ? 'Como Vendedor' : t.language === 'en' ? 'As Seller' : 'Como Vendedor', icon: ShoppingBag, count: userRatingsAsSeller.length },
        { id: 'customer-reviews', label: t.language === 'pt' ? 'Como Cliente' : t.language === 'en' ? 'As Customer' : 'Como Cliente', icon: User, count: userRatingsAsCustomer.length },
      ]
    : [
        { id: 'seller-reviews', label: t.language === 'pt' ? 'Como Vendedor' : t.language === 'en' ? 'As Seller' : 'Como Vendedor', icon: ShoppingBag, count: userRatingsAsSeller.length },
        { id: 'customer-reviews', label: t.language === 'pt' ? 'Como Cliente' : t.language === 'en' ? 'As Customer' : 'Como Cliente', icon: User, count: userRatingsAsCustomer.length },
      ];

  return (
    <div className="mt-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Stats grid for sellers */}
      {isSeller && stats && (
        <div className="px-4 sm:px-6 py-3">
          <div className="grid grid-cols-4 gap-2">
            <StatCard icon={<ShoppingBag className="h-4 w-4" />} value={stats.total_sales} label={t.language === 'pt' ? 'Vendas' : t.language === 'en' ? 'Sales' : 'Ventas'} color={themeColor} />
            <StatCard icon={<Package className="h-4 w-4" />} value={stats.active_products} label={t.language === 'pt' ? 'Produtos' : t.language === 'en' ? 'Products' : 'Productos'} color="#10b981" />
            <StatCard icon={<Star className="h-4 w-4" />} value={stats.average_rating.toFixed(1)} label={t.language === 'pt' ? 'Avaliação' : t.language === 'en' ? 'Rating' : 'Calificación'} color="#f59e0b" />
            <StatCard icon={<TrendingUp className="h-4 w-4" />} value={stats.total_reviews} label={t.language === 'pt' ? 'Avaliações' : t.language === 'en' ? 'Reviews' : 'Reseñas'} color="#8b5cf6" />
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-gray-100 dark:border-gray-700 scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors relative ${
              activeTab === tab.id
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            <span>{tab.label}</span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}
              style={activeTab === tab.id ? { backgroundColor: themeColor } : {}}
            >
              {tab.count}
            </span>
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: themeColor }} />
            )}
          </button>
        ))}
      </div>

      <div className="p-3 sm:p-4">
        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <div>
            {products.length === 0 ? (
              <EmptyState icon={<Package className="h-12 w-12 text-gray-300 dark:text-gray-600" />} message={t.language === 'pt' ? 'Nenhum produto disponível' : t.language === 'en' ? 'No products available' : 'No hay productos disponibles'} />
            ) : (
              <>
                {productCategories.length > 2 && (
                  <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                    {productCategories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => { setProductFilter(cat); setCurrentPage(1); }}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                          productFilter === cat
                            ? 'text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                        style={productFilter === cat ? { backgroundColor: themeColor } : {}}
                      >
                        {cat === 'all' ? (t.language === 'pt' ? 'Todos' : t.language === 'en' ? 'All' : 'Todos') : cat}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {paginatedProducts.map((product) => {
                    const hasPromo = product.promotion_active && product.promotional_price_usdt;
                    const price = hasPromo ? Number(product.promotional_price_usdt) : Number(product.price_usdt);
                    const isFeatured = (product as any).is_featured === true;
                    return (
                      <div
                        key={product.id}
                        onClick={() => onProductClick?.(product)}
                        className={`group bg-white dark:bg-gray-900 rounded-xl overflow-hidden border transition-all duration-300 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 ${
                          isFeatured
                            ? 'border-amber-300 dark:border-amber-600 ring-1 ring-amber-300/50 dark:ring-amber-600/30'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        {isFeatured && (
                          <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700">
                            <Sparkles className="h-3 w-3 text-amber-500" />
                            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                              {t.language === 'pt' ? 'Destaque' : t.language === 'en' ? 'Featured' : 'Destacado'}
                            </span>
                          </div>
                        )}
                        <div className="relative">
                          <ProductImage src={product.image_url} alt={product.name} hoverScale rounded="rounded-none" className="rounded-none ring-0" />
                          {hasPromo && (
                            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white">
                              {t.language === 'pt' ? 'Promo' : 'Promo'}
                            </span>
                          )}
                        </div>
                        <div className="p-2.5">
                          <h3 className="font-semibold text-xs text-gray-900 dark:text-white mb-1 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {product.name}
                          </h3>
                          <div className="mb-1.5">
                            <ProductRatingsDisplay productId={product.id} showTitle={false} compact={true} />
                          </div>
                          <div className="mb-2">
                            {product.manual_delivery ? (
                              product.account_recharge ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                  <Zap className="h-2.5 w-2.5" />
                                  {t.language === 'pt' ? 'Recarga' : t.language === 'en' ? 'Recharge' : 'Recarga'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                                  <Truck className="h-2.5 w-2.5" />
                                  {t.language === 'pt' ? 'Manual' : t.language === 'en' ? 'Manual' : 'Manual'}
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                                <Zap className="h-2.5 w-2.5" />
                                {t.language === 'pt' ? 'Automático' : t.language === 'en' ? 'Automatic' : 'Automático'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            {hasPromo && (
                              <span className="text-[10px] text-gray-400 line-through">
                                {formatPrice(Number(product.price_usdt))}
                              </span>
                            )}
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {formatPrice(price)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1.5 mt-6">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === page
                            ? 'text-white shadow-sm'
                            : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        style={currentPage === page ? { backgroundColor: themeColor } : {}}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {filteredProducts.length === 0 && (
                  <EmptyState icon={<Package className="h-12 w-12 text-gray-300 dark:text-gray-600" />} message={t.language === 'pt' ? 'Nenhum produto nesta categoria' : t.language === 'en' ? 'No products in this category' : 'No hay productos en esta categoría'} />
                )}
              </>
            )}
          </div>
        )}

        {/* PRODUCT REVIEWS TAB */}
        {activeTab === 'reviews' && (
          <div>
            {ratings.length === 0 ? (
              <EmptyState icon={<Star className="h-12 w-12 text-gray-300 dark:text-gray-600" />} message={t.language === 'pt' ? 'Nenhuma avaliação ainda' : t.language === 'en' ? 'No reviews yet' : 'Sin reseñas todavía'} />
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.average_rating.toFixed(1) || '0.0'}</div>
                      <div className="flex items-center gap-0.5 mt-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(stats?.average_rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 space-y-1.5">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = ratingDistribution[star - 1];
                        const pct = ratings.length > 0 ? (count / ratings.length) * 100 : 0;
                        return (
                          <div key={star} className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500 dark:text-gray-400 w-6">{star}★</span>
                            <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-amber-400 h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-gray-500 dark:text-gray-400 w-6 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {ratings.map((rating) => (
                  <div key={rating.id} className="rounded-2xl p-4 bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => rating.buyer_user_id && navigateToUserProfile(rating.buyer_user_id)}
                          className="h-9 w-9 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                          style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}aa)` }}
                        >
                          {rating.buyer_avatar ? (
                            <img src={rating.buyer_avatar} alt="" className="h-full w-full object-cover" />
                          ) : (
                            rating.buyer_name?.charAt(0).toUpperCase() || 'U'
                          )}
                        </button>
                        <div>
                          <button
                            onClick={() => rating.buyer_user_id && navigateToUserProfile(rating.buyer_user_id)}
                            className={`font-medium text-sm text-gray-900 dark:text-white ${rating.buyer_user_id ? 'hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer' : 'cursor-default'}`}
                          >
                            {rating.buyer_name}
                          </button>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{rating.product_name}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < rating.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
                          ))}
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(rating.created_at)}</span>
                      </div>
                    </div>
                    {rating.comment && <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">{rating.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SELLER REVIEWS TAB */}
        {activeTab === 'seller-reviews' && (
          <div>
            {userRatingsAsSeller.length === 0 ? (
              <EmptyState icon={<ShoppingBag className="h-12 w-12 text-gray-300 dark:text-gray-600" />} message={t.language === 'pt' ? 'Nenhuma avaliação como vendedor' : t.language === 'en' ? 'No seller reviews yet' : 'Sin reseñas como vendedor'} />
            ) : (
              <div className="space-y-4">
                {userRatingsAsSeller.map((rating) => (
                  <div key={rating.id} className="rounded-2xl p-4 bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => rating.rater_id && navigateToUserProfile(rating.rater_id)}
                          className="h-9 w-9 rounded-full overflow-hidden flex items-center justify-center bg-blue-500 text-white font-semibold text-sm flex-shrink-0"
                        >
                          {rating.rater_avatar ? (
                            <img src={rating.rater_avatar} alt="" className="h-full w-full object-cover" />
                          ) : (
                            rating.rater_name?.charAt(0).toUpperCase() || 'U'
                          )}
                        </button>
                        <div>
                          <button
                            onClick={() => rating.rater_id && navigateToUserProfile(rating.rater_id)}
                            className={`font-medium text-sm text-gray-900 dark:text-white ${rating.rater_id ? 'hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer' : 'cursor-default'}`}
                          >
                            {rating.rater_name}
                          </button>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ml-2">
                            {t.language === 'pt' ? 'Cliente' : t.language === 'en' ? 'Customer' : 'Cliente'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < rating.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
                          ))}
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(rating.created_at)}</span>
                      </div>
                    </div>
                    {rating.comment && <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">{rating.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CUSTOMER REVIEWS TAB */}
        {activeTab === 'customer-reviews' && (
          <div>
            {userRatingsAsCustomer.length === 0 ? (
              <EmptyState icon={<User className="h-12 w-12 text-gray-300 dark:text-gray-600" />} message={t.language === 'pt' ? 'Nenhuma avaliação como cliente' : t.language === 'en' ? 'No customer reviews yet' : 'Sin reseñas como cliente'} />
            ) : (
              <div className="space-y-4">
                {userRatingsAsCustomer.map((rating) => (
                  <div key={rating.id} className="rounded-2xl p-4 bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => rating.rater_id && navigateToUserProfile(rating.rater_id)}
                          className="h-9 w-9 rounded-full overflow-hidden flex items-center justify-center bg-green-500 text-white font-semibold text-sm flex-shrink-0"
                        >
                          {rating.rater_avatar ? (
                            <img src={rating.rater_avatar} alt="" className="h-full w-full object-cover" />
                          ) : (
                            rating.rater_name?.charAt(0).toUpperCase() || 'U'
                          )}
                        </button>
                        <div>
                          <button
                            onClick={() => rating.rater_id && navigateToUserProfile(rating.rater_id)}
                            className={`font-medium text-sm text-gray-900 dark:text-white ${rating.rater_id ? 'hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer' : 'cursor-default'}`}
                          >
                            {rating.rater_name}
                          </button>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ml-2">
                            {t.language === 'pt' ? 'Vendedor' : t.language === 'en' ? 'Seller' : 'Vendedor'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < rating.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
                          ))}
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(rating.created_at)}</span>
                      </div>
                    </div>
                    {rating.comment && <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">{rating.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Seller Reputation */}
      {isSeller && (
        <div className="mt-6 px-4 sm:px-6">
          <SellerReputation sellerId={profileId} sellerName="" />
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: React.ReactNode; label: string; color: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl p-2.5 bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 transition-all hover:shadow-md">
      <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full opacity-10 blur-xl" style={{ background: color }} />
      <div className="relative">
        <div className="inline-flex items-center justify-center h-7 w-7 rounded-lg mb-1" style={{ backgroundColor: `${color}1a`, color }}>
          {icon}
        </div>
        <div className="text-sm font-bold text-gray-900 dark:text-white">{value}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center mb-3">{icon}</div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}
