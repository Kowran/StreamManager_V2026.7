import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, ArrowRight, Package, Check, Truck, ShoppingCart, Star,
  Sun, Moon, LogIn, Menu, X, AlertCircle, Loader, UserCheck, CreditCard
} from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { useTheme } from './ThemeProvider';
import { LanguageSelector } from './LanguageSelector';
import { supabase } from '../lib/supabase';
import { LoginModal } from './LoginModal';
import { Footer } from './Footer';
import { ProductRatingsDisplay } from './ProductRatingsDisplay';

interface StoreProduct {
  id: string;
  name: string;
  description: string | null;
  price_brl: number;
  price_usdt: number;
  category: string;
  image_url: string | null;
  stock_quantity: number;
  manual_delivery: boolean;
  slug: string;
  promotional_price_usdt: number | null;
  promotion_active: boolean;
}

interface StoreConfig {
  store_name?: string;
  store_logo_url?: string;
  store_description?: string;
}

interface ProductDetailPageProps {
  product: StoreProduct;
  onBack: () => void;
  onGetStarted: () => void;
}

export function ProductDetailPage({ product, onBack, onGetStarted }: ProductDetailPageProps) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { theme, toggleTheme } = useTheme();
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<StoreProduct[]>([]);

  useEffect(() => {
    loadStoreConfig();
    loadRelatedProducts();
  }, [product.id]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [product.id]);

  async function loadStoreConfig() {
    try {
      const { data } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'store_config')
        .maybeSingle();
      if (data?.value) setStoreConfig(data.value);
    } catch { /* ignore */ }
  }

  async function loadRelatedProducts() {
    try {
      const { data, error } = await supabase
        .from('store_products')
        .select('id, name, description, price_brl, price_usdt, category, image_url, stock_quantity, manual_delivery, slug, promotional_price_usdt, promotion_active')
        .eq('active', true)
        .eq('category', product.category)
        .neq('id', product.id)
        .order('created_at', { ascending: false })
        .limit(4);
      if (!error && data) setRelatedProducts(data);
    } catch { /* ignore */ }
  }

  const hasPromo = product.promotion_active && product.promotional_price_usdt;
  const effectivePrice = hasPromo ? Number(product.promotional_price_usdt) : Number(product.price_usdt);
  const isAvailable = product.manual_delivery || product.stock_quantity > 0;

  function handleBuyNow() {
    setShowLoginModal(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200/20 dark:border-gray-700/20 px-4 sm:px-6 lg:px-8 py-4 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="hidden sm:inline text-sm font-medium">
                {t.language === 'pt' ? 'Voltar' : t.language === 'en' ? 'Back' : 'Volver'}
              </span>
            </button>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
            {storeConfig?.store_logo_url ? (
              <img src={storeConfig.store_logo_url} alt="Logo" className="h-8 w-8 object-cover rounded-lg"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : null}
            <div className={`bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg ${storeConfig?.store_logo_url ? 'hidden' : ''}`}>
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white hidden sm:block">
              {storeConfig?.store_name || 'StreamManager'}
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            <button onClick={toggleTheme} className="hidden md:flex p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <button onClick={onGetStarted} className="hidden md:inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
              <LogIn className="h-4 w-4 mr-2" />
              <span>{t.language === 'pt' ? 'Entrar' : t.language === 'en' ? 'Sign In' : 'Iniciar Sesion'}</span>
            </button>
            <LanguageSelector />
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsMobileMenuOpen(!isMobileMenuOpen); }}
              className="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-lg animate-slide-down z-50">
            <div className="px-4 py-4 space-y-3">
              <button onClick={() => { toggleTheme(); setIsMobileMenuOpen(false); }}
                className="w-full flex items-center justify-between p-3 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <span className="font-medium">
                  {theme === 'light' ? (t.language === 'pt' ? 'Modo Escuro' : 'Dark Mode') : (t.language === 'pt' ? 'Modo Claro' : 'Light Mode')}
                </span>
                {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              </button>
              <button onClick={() => { onGetStarted(); setIsMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center p-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
                <LogIn className="h-5 w-5 mr-2" />
                <span>{t.language === 'pt' ? 'Entrar' : t.language === 'en' ? 'Sign In' : 'Iniciar Sesion'}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Product Detail Content */}
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Product Image */}
            <div className="relative">
              <div className="aspect-square sm:aspect-[4/3] lg:aspect-square bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden shadow-xl">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                    <Package className="h-24 w-24 text-white opacity-50" />
                  </div>
                )}
              </div>
              {/* Category badge */}
              <span className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-medium bg-black/50 backdrop-blur-sm text-white capitalize">
                {product.category}
              </span>
              {/* Availability badge */}
              {!isAvailable && (
                <span className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium bg-red-500/90 backdrop-blur-sm text-white">
                  {t.language === 'pt' ? 'Esgotado' : t.language === 'en' ? 'Sold Out' : 'Agotado'}
                </span>
              )}
              {isAvailable && !product.manual_delivery && product.stock_quantity > 0 && product.stock_quantity <= 5 && (
                <span className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium bg-orange-500/90 backdrop-blur-sm text-white">
                  {t.language === 'pt' ? `Restam ${product.stock_quantity}` : t.language === 'en' ? `${product.stock_quantity} left` : `Quedan ${product.stock_quantity}`}
                </span>
              )}
            </div>

            {/* Product Info */}
            <div className="flex flex-col">
              {/* Delivery badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {product.manual_delivery ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    <Truck className="h-4 w-4 mr-1.5" />
                    {t.language === 'pt' ? 'Entrega Manual' : t.language === 'en' ? 'Manual Delivery' : 'Entrega Manual'}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    <Truck className="h-4 w-4 mr-1.5" />
                    {t.language === 'pt' ? 'Entrega Automática' : t.language === 'en' ? 'Auto Delivery' : 'Entrega Automatica'}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
                {product.name}
              </h1>

              {/* Price */}
              <div className="flex items-baseline gap-3 mb-6">
                {hasPromo && (
                  <span className="text-2xl text-gray-400 line-through">
                    {formatPrice(Number(product.price_usdt))}
                  </span>
                )}
                <span className={`text-4xl font-bold ${hasPromo ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                  {formatPrice(effectivePrice)}
                </span>
              </div>

              {/* Description */}
              {product.description && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 uppercase tracking-wide">
                    {t.language === 'pt' ? 'Descricao' : t.language === 'en' ? 'Description' : 'Descripcion'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Stock Info */}
              {!product.manual_delivery && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                      {t.language === 'pt' ? 'Disponibilidade' : t.language === 'en' ? 'Availability' : 'Disponibilidad'}
                    </span>
                    <span className={`font-bold text-lg ${
                      product.stock_quantity > 5
                        ? 'text-green-600 dark:text-green-400'
                        : product.stock_quantity > 0
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {product.stock_quantity} {t.language === 'pt' ? 'em estoque' : t.language === 'en' ? 'in stock' : 'en stock'}
                    </span>
                  </div>
                </div>
              )}

              {/* Ratings */}
              <div className="mb-6">
                <ProductRatingsDisplay productId={product.id} showTitle={true} compact={false} />
              </div>

              {/* Action Buttons */}
              <div className="mt-auto space-y-3">
                <button
                  onClick={handleBuyNow}
                  disabled={!isAvailable}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-lg transition-all ${
                    isAvailable
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/30 hover:scale-[1.02]'
                      : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <ShoppingCart className="h-6 w-6" />
                  <span>
                    {!isAvailable
                      ? (t.language === 'pt' ? 'Esgotado' : t.language === 'en' ? 'Sold Out' : 'Agotado')
                      : (t.language === 'pt' ? 'Entrar para Comprar' : t.language === 'en' ? 'Sign In to Buy' : 'Iniciar Sesion para Comprar')
                    }
                  </span>
                  <ArrowRight className="h-5 w-5" />
                </button>
                <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                  {t.language === 'pt'
                    ? 'Entre ou cadastre-se para completar sua compra'
                    : t.language === 'en'
                    ? 'Sign in or register to complete your purchase'
                    : 'Inicia sesion o registrate para completar tu compra'}
                </p>
              </div>
            </div>
          </div>

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div className="mt-16 pt-12 border-t border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                {t.language === 'pt' ? 'Produtos Relacionados' : t.language === 'en' ? 'Related Products' : 'Productos Relacionados'}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                {relatedProducts.map((rp) => {
                  const rpAvail = rp.manual_delivery || rp.stock_quantity > 0;
                  const rpPromo = rp.promotion_active && rp.promotional_price_usdt;
                  return (
                    <div
                      key={rp.id}
                      onClick={() => { onBack(); }}
                      className="group relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 dark:border-gray-700 hover:-translate-y-1"
                    >
                      <div className="relative aspect-video overflow-hidden bg-gray-100 dark:bg-gray-700">
                        {rp.image_url ? (
                          <img src={rp.image_url} alt={rp.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                          </div>
                        )}
                        {!rpAvail && (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-xs font-medium bg-red-500/80 backdrop-blur-sm text-white">
                            {t.language === 'pt' ? 'Esgotado' : t.language === 'en' ? 'Sold Out' : 'Agotado'}
                          </span>
                        )}
                      </div>
                      <div className="p-3 lg:p-4">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1 line-clamp-1">{rp.name}</h3>
                        <div className="flex items-baseline gap-2">
                          {rpPromo ? (
                            <>
                              <span className="text-base font-bold text-red-500">{formatPrice(Number(rp.promotional_price_usdt))}</span>
                              <span className="text-xs text-gray-400 line-through">{formatPrice(Number(rp.price_usdt))}</span>
                            </>
                          ) : (
                            <span className="text-base font-bold text-gray-900 dark:text-white">{formatPrice(Number(rp.price_usdt))}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={onGetStarted}
      />

      <Footer />
    </div>
  );
}
