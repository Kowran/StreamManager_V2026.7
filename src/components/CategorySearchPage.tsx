import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, Search, Package, Loader, Truck, Zap } from 'lucide-react';
import { supabase, StoreProduct, ProductCategory } from '../lib/supabase';
import { useCurrency } from './CurrencyProvider';
import { useLanguage } from './LanguageProvider';

interface CategorySearchPageProps {
  slug: string;
  onBack: () => void;
  onProductClick: (product: StoreProduct) => void;
  onNavigate?: (tab: string) => void;
}

interface ProductWithSeller extends StoreProduct {
  seller_info?: {
    business_name: string;
    sales_count: number;
    seller_slug?: string;
  };
}

export function CategorySearchPage({ slug, onBack, onProductClick }: CategorySearchPageProps) {
  const { t, language } = useLanguage();
  const { formatPrice } = useCurrency();
  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [products, setProducts] = useState<ProductWithSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'price_low' | 'price_high' | 'newest' | 'best_selling'>('relevance');

  useEffect(() => {
    loadCategoryAndProducts();
  }, [slug]);

  async function loadCategoryAndProducts() {
    setLoading(true);
    setError('');
    try {
      const { data: cat, error: catErr } = await supabase
        .from('product_categories')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();
      if (catErr) throw catErr;
      if (!cat) {
        setError(language === 'pt' ? 'Categoria não encontrada' : language === 'en' ? 'Category not found' : 'Categoría no encontrada');
        return;
      }
      setCategory(cat);

      const { data: rawProducts, error: prodErr } = await supabase
        .from('store_products')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (prodErr) throw prodErr;

      const keywords = (cat.search_keywords || []).map(k => k.toLowerCase().trim()).filter(Boolean);
      const matches = (rawProducts || []).filter((p: any) => {
        const name = (p.name || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        return keywords.some(kw => name.includes(kw) || desc.includes(kw));
      });

      const sellerCache: Record<string, { business_name: string; seller_slug?: string }> = {};
      const withSellers: ProductWithSeller[] = await Promise.all(
        matches.map(async (p: any) => {
          let sellerInfo: ProductWithSeller['seller_info'];
          if (p.seller_id) {
            let sd = sellerCache[p.seller_id];
            if (!sd) {
              const { data } = await supabase
                .from('profiles')
                .select('full_name, username, seller_slug')
                .eq('id', p.seller_id)
                .maybeSingle();
              if (data) {
                sd = {
                  business_name: (data as any).full_name || (data as any).username || (data as any).seller_slug || 'Vendedor',
                  seller_slug: (data as any).seller_slug,
                };
                sellerCache[p.seller_id] = sd;
              }
            }
            sellerInfo = { business_name: sd?.business_name || 'Vendedor', sales_count: 0, seller_slug: sd?.seller_slug };
          } else {
            sellerInfo = { business_name: 'Admin', sales_count: 0 };
          }

          let totalStock = p.stock_quantity;
          if (!p.manual_delivery && !(p as any).account_recharge) {
            const { data: stockCount } = await supabase.rpc('get_product_total_stock', { p_product_id: p.id });
            if (stockCount !== null && stockCount !== undefined) totalStock = stockCount;
          }

          return { ...p, stock_quantity: totalStock, seller_info: sellerInfo };
        })
      );

      setProducts(withSellers);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let list = products;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
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
  }, [products, searchTerm, sortBy]);

  const handleProductClick = useCallback((product: StoreProduct) => {
    onProductClick(product);
  }, [onProductClick]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Loader className="h-10 w-10 animate-spin text-blue-500" />
        <p className="mt-3 text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="w-full mx-auto px-4 py-12 text-center">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error || 'Category not found'}</p>
        <button onClick={onBack} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Store
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
        {language === 'pt' ? 'Voltar à loja' : language === 'en' ? 'Back to store' : 'Volver a la tienda'}
      </button>

      {/* Hero header */}
      <div className="relative rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-gray-900 to-gray-700 min-h-[180px] sm:min-h-[220px]">
        {category.image_url && (
          <img src={category.image_url} alt={category.name} className="absolute inset-0 w-full h-full object-cover opacity-50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
        <div className="relative p-6 sm:p-8 flex flex-col justify-end h-full min-h-[180px] sm:min-h-[220px]">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{category.name}</h1>
          <p className="text-white/80 text-sm">
            {language === 'pt' ? `${filtered.length} anúncios encontrados` : language === 'en' ? `${filtered.length} listings found` : `${filtered.length} anuncios encontrados`}
          </p>
        </div>
      </div>

      {/* Search + sort bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={language === 'pt' ? 'Buscar nesta categoria...' : language === 'en' ? 'Search in this category...' : 'Buscar en esta categoría...'}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="relevance">{language === 'pt' ? 'Relevância' : 'Relevance'}</option>
          <option value="price_low">{language === 'pt' ? 'Menor preço' : 'Price: Low'}</option>
          <option value="price_high">{language === 'pt' ? 'Maior preço' : 'Price: High'}</option>
          <option value="newest">{language === 'pt' ? 'Mais recentes' : 'Newest'}</option>
          <option value="best_selling">{language === 'pt' ? 'Mais vendidos' : 'Best selling'}</option>
        </select>
      </div>

      {/* Products grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-14 w-14 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            {language === 'pt' ? 'Nenhum anúncio encontrado para esta categoria ainda.' : 'No listings found for this category yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map(product => {
            const available = (product as any).manual_delivery || product.stock_quantity > 0;
            const hasPromo = product.promotion_active && product.promotional_price_usdt;
            return (
              <div
                key={product.id}
                onClick={() => handleProductClick(product)}
                className="group relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer border border-gray-200 dark:border-gray-700 hover:-translate-y-1"
              >
                <div className="relative aspect-video overflow-hidden bg-gray-100 dark:bg-gray-700">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                    </div>
                  )}
                  {!available && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-xs font-medium bg-red-500/80 backdrop-blur-sm text-white">
                      {language === 'pt' ? 'Esgotado' : 'Sold Out'}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1 line-clamp-1">{product.name}</h3>
                  {product.seller_info?.business_name && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 truncate">{product.seller_info.business_name}</p>
                  )}
                  <div className="mb-1.5 flex items-center gap-1">
                    {(product as any).manual_delivery ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        <Truck className="h-2.5 w-2.5 mr-0.5" />{language === 'pt' ? 'Manual' : 'Manual'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        <Zap className="h-2.5 w-2.5 mr-0.5" />{language === 'pt' ? 'Automático' : 'Auto'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    {hasPromo ? (
                      <>
                        <span className="text-base font-bold text-red-500">{formatPrice(Number(product.promotional_price_usdt))}</span>
                        <span className="text-xs text-gray-400 line-through">{formatPrice(Number(product.price_usdt))}</span>
                      </>
                    ) : (
                      <span className="text-base font-bold text-gray-900 dark:text-white">{formatPrice(Number(product.price_usdt))}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
