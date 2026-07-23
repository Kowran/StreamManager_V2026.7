import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ChevronLeft, Search, Package, Loader, Truck, Zap, X, Star, UserCheck, Coins, Smartphone, Gamepad2, Gift, LayoutGrid, ShoppingCart, TrendingUp, ArrowRight, SlidersHorizontal, Tag, CheckCircle2, type LucideIcon } from 'lucide-react';
import { supabase, StoreProduct, PrimaryCategory, PRIMARY_CATEGORIES } from '../lib/supabase';
import { useCurrency } from './CurrencyProvider';
import { useLanguage } from './LanguageProvider';
import { ProductRatingsDisplay } from './ProductRatingsDisplay';

interface SearchResultsPageProps {
  query: string;
  onBack: () => void;
  onProductClick: (product: StoreProduct) => void;
  onNavigate?: (tab: string) => void;
  onViewSellerProfile?: (sellerId: string | null, sellerSlug?: string) => void;
}

interface ProductWithSeller extends StoreProduct {
  seller_info?: {
    business_name: string;
    sales_count: number;
    seller_slug?: string;
    seller_rating?: number;
    seller_rating_count?: number;
    seller_avatar?: string | null;
  };
}

const primaryCategoryConfig: Record<PrimaryCategory, { icon: LucideIcon; label: string; color: { activeBg: string; activeText: string; badgeActive: string } }> = {
  account: { icon: UserCheck, label: 'Conta', color: { activeBg: 'bg-blue-500', activeText: 'text-white', badgeActive: 'bg-blue-600 text-white' } },
  item: { icon: Package, label: 'Item', color: { activeBg: 'bg-emerald-500', activeText: 'text-white', badgeActive: 'bg-emerald-600 text-white' } },
  mobile_recharge: { icon: Smartphone, label: 'Recarga de Celular', color: { activeBg: 'bg-purple-500', activeText: 'text-white', badgeActive: 'bg-purple-600 text-white' } },
  game: { icon: Gamepad2, label: 'Jogo', color: { activeBg: 'bg-orange-500', activeText: 'text-white', badgeActive: 'bg-orange-600 text-white' } },
  gift_card: { icon: Gift, label: 'Gift Card', color: { activeBg: 'bg-pink-500', activeText: 'text-white', badgeActive: 'bg-pink-600 text-white' } },
  top_up: { icon: Coins, label: 'Top-Up', color: { activeBg: 'bg-amber-500', activeText: 'text-white', badgeActive: 'bg-amber-600 text-white' } },
};

interface FilterState {
  minPrice: string;
  maxPrice: string;
  deliveryType: 'all' | 'auto' | 'manual' | 'recharge';
  inStockOnly: boolean;
  onPromotion: boolean;
  minRating: number;
  sellerId: string | null;
}

const defaultFilters: FilterState = {
  minPrice: '',
  maxPrice: '',
  deliveryType: 'all',
  inStockOnly: false,
  onPromotion: false,
  minRating: 0,
  sellerId: null,
};

export function SearchResultsPage({ query, onBack, onProductClick, onViewSellerProfile }: SearchResultsPageProps) {
  const { language } = useLanguage();
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<ProductWithSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState(query);
  const [sortBy, setSortBy] = useState<'relevance' | 'price_low' | 'price_high' | 'newest' | 'best_selling'>('relevance');
  const [activePrimaryCategory, setActivePrimaryCategory] = useState<'all' | PrimaryCategory>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [sellers, setSellers] = useState<Array<{ id: string; name: string; avatar?: string | null }>>([]);
  const filtersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError('');
    try {
      const { data: rawProducts, error: prodErr } = await supabase
        .from('store_products')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (prodErr) throw prodErr;

      const sellerProfileCache: Record<string, { business_name: string; seller_slug?: string; rating: number; rating_count: number; avatar?: string | null }> = {};

      async function getSellerInfo(sellerId: string) {
        if (sellerProfileCache[sellerId]) return sellerProfileCache[sellerId];
        const { data: sd } = await supabase
          .from('profiles')
          .select('full_name, username, seller_slug, avatar_url')
          .eq('id', sellerId)
          .maybeSingle();
        const { data: ratingData } = await supabase
          .from('user_ratings')
          .select('rating')
          .eq('rated_user_id', sellerId)
          .eq('rater_role', 'customer');
        const ratings = (ratingData || []).map(r => r.rating).filter(r => typeof r === 'number');
        const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
        const info = {
          business_name: sd?.full_name || sd?.username || sd?.seller_slug || 'Vendedor',
          seller_slug: sd?.seller_slug,
          rating: avg,
          rating_count: ratings.length,
          avatar: sd?.avatar_url || null,
        };
        sellerProfileCache[sellerId] = info;
        return info;
      }

      const withSellers: ProductWithSeller[] = await Promise.all(
        (rawProducts || []).map(async (p: any) => {
          let salesCount = 0;
          try {
            const { data: productSalesCount } = await supabase.rpc('get_product_sales_count', { product_uuid: p.id });
            salesCount = Number(productSalesCount) || 0;
          } catch { /* ignore */ }

          let sellerInfo: ProductWithSeller['seller_info'];
          if (p.seller_id) {
            const info = await getSellerInfo(p.seller_id);
            sellerInfo = {
              business_name: info.business_name,
              sales_count: salesCount,
              seller_slug: info.seller_slug,
              seller_rating: info.rating,
              seller_rating_count: info.rating_count,
              seller_avatar: info.avatar,
            };
          } else {
            sellerInfo = { business_name: 'Admin', sales_count: salesCount, seller_rating: 0, seller_rating_count: 0, seller_avatar: null };
          }

          let totalStock = p.stock_quantity;
          if (!p.manual_delivery && !(p as any).account_recharge) {
            try {
              const { data: stockCount } = await supabase.rpc('get_product_total_stock', { p_product_id: p.id });
              if (stockCount !== null && stockCount !== undefined) totalStock = stockCount;
            } catch { /* ignore */ }
          }

          return { ...p, stock_quantity: totalStock, seller_info: sellerInfo };
        })
      );

      setProducts(withSellers);

      // Build unique seller list for filter dropdown
      const sellerMap = new Map<string, { id: string; name: string; avatar?: string | null }>();
      withSellers.forEach(p => {
        if (p.seller_id && p.seller_info) {
          if (!sellerMap.has(p.seller_id)) {
            sellerMap.set(p.seller_id, { id: p.seller_id, name: p.seller_info.business_name, avatar: p.seller_info.seller_avatar });
          }
        }
      });
      setSellers(Array.from(sellerMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const primaryCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => {
      const pc = (p as any).primary_category || 'item';
      counts[pc] = (counts[pc] || 0) + 1;
    });
    return [
      { key: 'all' as const, label: language === 'pt' ? 'Todos' : language === 'en' ? 'All' : 'Todos', icon: LayoutGrid, color: { activeBg: 'bg-gray-900', activeText: 'text-white', badgeActive: 'bg-gray-800 text-white' }, count: products.length },
      ...PRIMARY_CATEGORIES.map(cat => ({
        key: cat.key,
        label: primaryCategoryConfig[cat.key].label,
        icon: primaryCategoryConfig[cat.key].icon,
        color: primaryCategoryConfig[cat.key].color,
        count: counts[cat.key] || 0,
      })).filter(c => c.count > 0),
    ];
  }, [products, language]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.minPrice) count++;
    if (filters.maxPrice) count++;
    if (filters.deliveryType !== 'all') count++;
    if (filters.inStockOnly) count++;
    if (filters.onPromotion) count++;
    if (filters.minRating > 0) count++;
    if (filters.sellerId) count++;
    return count;
  }, [filters]);

  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase().trim();
    let list = products;
    if (q) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }
    if (activePrimaryCategory !== 'all') {
      list = list.filter(p => ((p as any).primary_category || 'item') === activePrimaryCategory);
    }

    // Apply detailed filters
    if (filters.minPrice) {
      const min = parseFloat(filters.minPrice);
      if (!isNaN(min)) list = list.filter(p => Number(p.price_usdt) >= min);
    }
    if (filters.maxPrice) {
      const max = parseFloat(filters.maxPrice);
      if (!isNaN(max)) list = list.filter(p => Number(p.price_usdt) <= max);
    }
    if (filters.deliveryType !== 'all') {
      list = list.filter(p => {
        if (filters.deliveryType === 'auto') return !(p as any).manual_delivery;
        if (filters.deliveryType === 'manual') return (p as any).manual_delivery && !(p as any).account_recharge;
        if (filters.deliveryType === 'recharge') return (p as any).manual_delivery && (p as any).account_recharge;
        return true;
      });
    }
    if (filters.inStockOnly) {
      list = list.filter(p => (p as any).manual_delivery || (p as any).account_recharge || p.stock_quantity > 0);
    }
    if (filters.onPromotion) {
      list = list.filter(p => p.promotion_active && p.promotional_price_usdt);
    }
    if (filters.minRating > 0) {
      list = list.filter(p => (p.seller_info?.seller_rating || 0) >= filters.minRating);
    }
    if (filters.sellerId) {
      list = list.filter(p => p.seller_id === filters.sellerId);
    }

    const sorted = [...list];
    switch (sortBy) {
      case 'price_low':
        sorted.sort((a, b) => a.price_usdt - b.price_usdt);
        break;
      case 'price_high':
        sorted.sort((a, b) => b.price_usdt - a.price_usdt);
        break;
      case 'newest':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'best_selling':
        sorted.sort((a, b) => (b.seller_info?.sales_count || 0) - (a.seller_info?.sales_count || 0));
        break;
      default:
        break;
    }
    return sorted;
  }, [products, query, sortBy, activePrimaryCategory, filters]);

  const handleProductClick = useCallback((product: StoreProduct) => {
    onProductClick(product);
  }, [onProductClick]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigateToSearch(searchInput);
  };

  const onNavigateToSearch = (newQuery: string) => {
    window.history.pushState(null, '', `/search/${encodeURIComponent(newQuery)}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const resetFilters = () => setFilters(defaultFilters);

  const tr = (pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader className="h-10 w-10 animate-spin text-blue-500" />
        <p className="mt-3 text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full mx-auto px-4 py-12 text-center">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button onClick={onBack} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <ChevronLeft className="h-4 w-4 mr-1" /> {tr('Voltar à loja', 'Back to store', 'Volver a la tienda')}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Breadcrumb / back */}
      <button
        onClick={onBack}
        className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {tr('Voltar à loja', 'Back to store', 'Volver a la tienda')}
      </button>

      {/* Search header */}
      <div className="rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-blue-600 to-blue-800 min-h-[140px] sm:min-h-[180px] relative">
        <div className="absolute inset-0 opacity-20">
          <Search className="absolute right-8 top-1/2 -translate-y-1/2 h-32 w-32 text-white" />
        </div>
        <div className="relative p-6 sm:p-8 flex flex-col justify-center h-full min-h-[140px] sm:min-h-[180px]">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            {tr('Resultados da busca', 'Search results', 'Resultados de búsqueda')}
          </h1>
          <p className="text-white/80 text-sm">
            {query ? (
              <span>"{query}" — {filtered.length} {tr('produto(s) encontrado(s)', 'product(s) found', 'producto(s) encontrado(s)')}</span>
            ) : (
              <span>{filtered.length} {tr('produto(s) disponível(s)', 'product(s) available', 'producto(s) disponible(s)')}</span>
            )}
          </p>
        </div>
      </div>

      {/* Primary Category Filter */}
      {primaryCategories.length > 1 && (
        <div className="mb-4 sm:mb-6">
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-1.5 sm:gap-3">
            {primaryCategories.map(({ key, label, icon: Icon, color, count }) => (
              <button
                key={key}
                onClick={() => setActivePrimaryCategory(key)}
                className={`relative flex flex-col items-center justify-center gap-1 p-1.5 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all duration-200 group ${
                  activePrimaryCategory === key
                    ? `${color.activeBg} ${color.activeText} shadow-md sm:shadow-lg scale-[1.03] border-transparent`
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm sm:hover:shadow-md hover:scale-[1.02]'
                }`}
              >
                <div className={`p-1 sm:p-2.5 rounded-lg sm:rounded-xl transition-colors ${
                  activePrimaryCategory === key
                    ? 'bg-white/20'
                    : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'
                }`}>
                  <Icon className="h-4 w-4 sm:h-7 sm:w-7 flex-shrink-0" />
                </div>
                <span className="text-[10px] sm:text-sm font-bold text-center leading-tight">{label}</span>
                {count > 0 && (
                  <span className={`absolute top-1 right-1 sm:top-1.5 sm:right-1.5 text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 rounded-full ${
                    activePrimaryCategory === key
                      ? 'bg-white/25 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search + sort + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <Search className="h-4 w-4" />
          </button>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder={tr('Buscar produtos...', 'Search products...', 'Buscar productos...')}
            className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
        <div className="flex gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all text-sm font-medium ${
              showFilters || activeFilterCount > 0
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {tr('Filtros', 'Filters', 'Filtros')}
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="relevance">{tr('Relevância', 'Relevance', 'Relevancia')}</option>
            <option value="price_low">{tr('Menor preço', 'Price: Low', 'Precio: Bajo')}</option>
            <option value="price_high">{tr('Maior preço', 'Price: High', 'Precio: Alto')}</option>
            <option value="newest">{tr('Mais recentes', 'Newest', 'Más recientes')}</option>
            <option value="best_selling">{tr('Mais vendidos', 'Best selling', 'Más vendidos')}</option>
          </select>
        </div>
      </div>

      {/* Detailed Filter Panel */}
      {showFilters && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-blue-500" />
              {tr('Filtros Avançados', 'Advanced Filters', 'Filtros Avanzados')}
            </h3>
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
              >
                {tr('Limpar tudo', 'Clear all', 'Limpiar todo')}
              </button>
            )}
          </div>

          <div className="p-4 space-y-5">
            {/* Price Range */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                {tr('Faixa de Preço (USDT)', 'Price Range (USDT)', 'Rango de Precio (USDT)')}
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={filters.minPrice}
                    onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))}
                    placeholder={tr('Mín', 'Min', 'Mín')}
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <span className="text-gray-400 text-sm">—</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={filters.maxPrice}
                    onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))}
                    placeholder={tr('Máx', 'Max', 'Máx')}
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Type */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                {tr('Tipo de Entrega', 'Delivery Type', 'Tipo de Entrega')}
              </label>
              <div className="flex flex-wrap gap-2">
                {([
                  { key: 'all', label: tr('Todos', 'All', 'Todos'), icon: LayoutGrid },
                  { key: 'auto', label: tr('Automática', 'Automatic', 'Automática'), icon: Zap },
                  { key: 'manual', label: tr('Manual', 'Manual', 'Manual'), icon: Truck },
                  { key: 'recharge', label: tr('Recarga', 'Recharge', 'Recarga'), icon: Smartphone },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setFilters(f => ({ ...f, deliveryType: key }))}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      filters.deliveryType === key
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles: In Stock + On Promotion */}
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => setFilters(f => ({ ...f, inStockOnly: !f.inStockOnly }))}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  filters.inStockOnly
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {tr('Em estoque', 'In stock only', 'En stock')}
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, onPromotion: !f.onPromotion }))}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  filters.onPromotion
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Tag className="h-4 w-4" />
                {tr('Em promoção', 'On promotion', 'En promoción')}
              </button>
            </div>

            {/* Min Seller Rating */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                {tr('Avaliação Mínima do Vendedor', 'Minimum Seller Rating', 'Calificación Mínima del Vendedor')}
              </label>
              <div className="flex items-center gap-2">
                {[0, 1, 2, 3, 4, 5].map(r => (
                  <button
                    key={r}
                    onClick={() => setFilters(f => ({ ...f, minRating: r }))}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      filters.minRating === r
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {r === 0 ? (
                      tr('Todos', 'Any', 'Todos')
                    ) : (
                      <>
                        <Star className="h-3.5 w-3.5" />
                        {r}+
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Seller Filter */}
            {sellers.length > 1 && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  {tr('Vendedor', 'Seller', 'Vendedor')}
                </label>
                <select
                  value={filters.sellerId || ''}
                  onChange={e => setFilters(f => ({ ...f, sellerId: e.target.value || null }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{tr('Todos os vendedores', 'All sellers', 'Todos los vendedores')}</option>
                  {sellers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Products grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-14 w-14 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            {tr('Nenhum produto encontrado para a sua busca.', 'No products found for your search.', 'No se encontraron productos para tu búsqueda.')}
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {tr('Tente buscar por outro termo ou ajustar os filtros.', 'Try searching for another term or adjusting filters.', 'Intenta buscar otro término o ajustar los filtros.')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map(product => {
            const isAvailable = (product as any).manual_delivery || (product as any).account_recharge || product.stock_quantity > 0;
            const hasPromo = product.promotion_active && product.promotional_price_usdt;
            const discountPct = hasPromo
              ? Math.round((1 - Number(product.promotional_price_usdt) / Number(product.price_usdt)) * 100)
              : 0;
            const salesCount = (product as any).seller_info?.sales_count || 0;
            const lowStock = !(product as any).manual_delivery && !(product as any).account_recharge && product.stock_quantity > 0 && product.stock_quantity <= 5;
            const sellerAvatar = (product as any).seller_info?.seller_avatar;
            const sellerName = product.seller_info?.business_name || '';
            const sellerRating = product.seller_info?.seller_rating || 0;
            const sellerRatingCount = product.seller_info?.seller_rating_count || 0;
            return (
              <div
                key={product.id}
                onClick={() => handleProductClick(product)}
                className={`group relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer border border-gray-200 dark:border-gray-700 hover:-translate-y-1 min-w-0 ${
                  !isAvailable ? 'opacity-75' : ''
                }`}
              >
                {/* Product Image — clean, no tags */}
                <div className="relative aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${
                        !isAvailable ? 'grayscale opacity-60' : ''
                      }`}
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-600 ${!isAvailable ? 'grayscale opacity-60' : ''}`}>
                      <Package className="w-10 h-10 text-white" />
                    </div>
                  )}

                  {/* Out of Stock Overlay */}
                  {!isAvailable && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-500/80 backdrop-blur-sm text-white">
                        {tr('Esgotado', 'Sold Out', 'Agotado')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-2.5 sm:p-3 lg:p-4">
                  <h3 className="font-bold text-xs sm:text-sm lg:text-base text-gray-900 dark:text-white mb-1 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {product.name}
                  </h3>

                  {/* Seller info with avatar */}
                  {product.seller_info && (
                    <div className="mb-2 flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewSellerProfile?.(product.seller_id || null, product.seller_info?.seller_slug);
                        }}
                        className="flex items-center gap-1.5 group/seller"
                      >
                        {sellerAvatar ? (
                          <img
                            src={sellerAvatar}
                            alt={sellerName}
                            className="w-5 h-5 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-600 shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shrink-0">
                            <span className="text-[9px] font-bold text-white">
                              {sellerName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="text-xs text-blue-600 dark:text-blue-400 group-hover/seller:underline font-medium truncate max-w-[100px]">
                          {sellerName}
                        </span>
                      </button>
                      {sellerRating > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-500 shrink-0">
                          <Star className="h-2.5 w-2.5 fill-current" />
                          {sellerRating.toFixed(1)}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                        · {salesCount} {tr('vendas', 'sales', 'ventas')}
                      </span>
                    </div>
                  )}

                  {/* Product Rating */}
                  <div className="mb-3">
                    <ProductRatingsDisplay productId={product.id} showTitle={false} compact={true} />
                  </div>

                  {/* Tags moved below the card — category, delivery, promo, low stock, sales */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
                      {product.category}
                    </span>
                    {hasPromo && discountPct > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                        -{discountPct}%
                      </span>
                    )}
                    {(product as any).manual_delivery ? (
                      (product as any).account_recharge ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                          <Zap className="h-2.5 w-2.5 mr-0.5" />
                          {tr('Recarga', 'Recharge', 'Recarga')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                          <Truck className="h-2.5 w-2.5 mr-0.5" />
                          {tr('Manual', 'Manual', 'Manual')}
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                        <Zap className="h-2.5 w-2.5 mr-0.5" />
                        {tr('Auto', 'Auto', 'Auto')}
                      </span>
                    )}
                    {lowStock && (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                        {product.stock_quantity} {tr('restam', 'left', 'quedan')}
                      </span>
                    )}
                    {salesCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                        <TrendingUp className="h-2.5 w-2.5" />
                        {salesCount} {tr('vendidos', 'sold', 'vendidos')}
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                    {hasPromo ? (
                      <>
                        <span className="text-base sm:text-lg lg:text-xl font-bold text-red-500">
                          {formatPrice(Number(product.promotional_price_usdt))}
                        </span>
                        <span className="text-xs sm:text-sm text-gray-400 line-through">
                          {formatPrice(Number(product.price_usdt))}
                        </span>
                      </>
                    ) : (
                      <span className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 dark:text-white">
                        {formatPrice(Number(product.price_usdt))}
                      </span>
                    )}
                  </div>

                  {/* Action button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleProductClick(product); }}
                    disabled={!isAvailable}
                    className={`w-full px-2 sm:px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold ${
                      isAvailable
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    <span>
                      {!isAvailable
                        ? (tr('Esgotado', 'Sold Out', 'Agotado'))
                        : (tr('Comprar', 'Buy', 'Comprar'))
                      }
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
