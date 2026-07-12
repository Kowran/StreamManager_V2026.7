import React, { useState, useEffect, useMemo } from 'react';
import { CreditCard, ArrowRight, CheckCircle, Globe, MessageCircle, Mail, Phone, MapPin, LogIn, Sun, Moon, Menu, X, ChevronLeft, ChevronRight, Package, UserCheck, Search, LayoutGrid, Clapperboard, Code, KeyRound, Music, Gamepad2, Shield, Gift, BookOpen, Headphones, Smartphone, Server, Zap, Star, Tag, Store, type LucideIcon } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { LanguageSelector } from './LanguageSelector';
import { useTheme } from './ThemeProvider';
import { supabase } from '../lib/supabase';
import { LoginModal } from './LoginModal';
import { Footer } from './Footer';

interface LandingPageProps {
  onGetStarted: () => void;
}

interface StoreConfig {
  store_name?: string;
  store_logo_url?: string;
  store_description?: string;
  social_links?: {
    whatsapp?: string;
    email?: string;
    website?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    youtube?: string;
    linkedin?: string;
  };
  contact_info?: {
    email?: string;
    phone?: string;
    address?: string;
  };
  copyright?: string;
}

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  link_text: string | null;
  bg_color: string;
  text_color: string;
  text_position: string;
}

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
  seller_id?: string | null;
  seller_name?: string | null;
  seller_slug?: string | null;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const { t, language } = useLanguage();
  const { formatPrice } = useCurrency();
  // Rendered before rest of component when a product is selected
  // (see early return below)
  const { theme, toggleTheme } = useTheme();
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categoryConfig: Record<string, { icon: LucideIcon; label: string; color: { activeBg: string; activeText: string; badgeActive: string } }> = {
    streaming: { icon: Clapperboard, label: 'Streaming', color: { activeBg: 'bg-red-500', activeText: 'text-white', badgeActive: 'bg-red-600 text-white' } },
    software: { icon: Code, label: 'Software', color: { activeBg: 'bg-blue-500', activeText: 'text-white', badgeActive: 'bg-blue-600 text-white' } },
    access: { icon: KeyRound, label: 'Acessos', color: { activeBg: 'bg-green-500', activeText: 'text-white', badgeActive: 'bg-green-600 text-white' } },
    music: { icon: Music, label: 'Musica', color: { activeBg: 'bg-purple-500', activeText: 'text-white', badgeActive: 'bg-purple-600 text-white' } },
    games: { icon: Gamepad2, label: 'Games', color: { activeBg: 'bg-orange-500', activeText: 'text-white', badgeActive: 'bg-orange-600 text-white' } },
    security: { icon: Shield, label: 'Seguranca', color: { activeBg: 'bg-teal-500', activeText: 'text-white', badgeActive: 'bg-teal-600 text-white' } },
    giftcards: { icon: Gift, label: 'Gift Cards', color: { activeBg: 'bg-pink-500', activeText: 'text-white', badgeActive: 'bg-pink-600 text-white' } },
    courses: { icon: BookOpen, label: 'Cursos', color: { activeBg: 'bg-indigo-500', activeText: 'text-white', badgeActive: 'bg-indigo-600 text-white' } },
    design: { icon: Star, label: 'Design', color: { activeBg: 'bg-yellow-500', activeText: 'text-white', badgeActive: 'bg-yellow-600 text-white' } },
    accounts: { icon: UserCheck, label: 'Contas', color: { activeBg: 'bg-cyan-500', activeText: 'text-white', badgeActive: 'bg-cyan-600 text-white' } },
    social: { icon: MessageCircle, label: 'Social', color: { activeBg: 'bg-rose-500', activeText: 'text-white', badgeActive: 'bg-rose-600 text-white' } },
    other: { icon: Package, label: 'Outros', color: { activeBg: 'bg-gray-600', activeText: 'text-white', badgeActive: 'bg-gray-700 text-white' } },
  };

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
    const cats = Object.entries(counts)
      .map(([key, count]) => {
        const config = categoryConfig[key] || categoryConfig.other;
        return { key, label: config.label, icon: config.icon, color: config.color, count };
      })
      .sort((a, b) => b.count - a.count);
    return [
      { key: 'all', label: language === 'pt' ? 'Todos' : language === 'en' ? 'All' : 'Todos', icon: LayoutGrid, color: { activeBg: 'bg-gray-900', activeText: 'text-white', badgeActive: 'bg-gray-800 text-white' }, count: products.length },
      ...cats,
    ];
  }, [products, language]);

  useEffect(() => {
    loadStoreConfig();
    checkAffiliateCode();
    loadBanners();
    loadProducts();
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBanner(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  function checkAffiliateCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref) {
      setAffiliateCode(ref);
      trackAffiliateClick(ref);
    }
  }

  async function trackAffiliateClick(code: string) {
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-affiliate-click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliate_code: code, referrer: document.referrer }),
      });
    } catch (error) {
      console.error('Error tracking affiliate click:', error);
    }
  }

  async function loadStoreConfig() {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'store_config')
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setStoreConfig(data?.value || null);
    } catch (error) {
      console.error('Error loading store config:', error);
    }
  }

  async function loadBanners() {
    try {
      const { data, error } = await supabase
        .from('landing_banners')
        .select('id, title, subtitle, image_url, link_url, link_text, bg_color, text_color, text_position')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) return;
      setBanners(data || []);
    } catch { /* ignore */ }
  }

  async function loadProducts() {
    try {
      const { data, error } = await supabase
        .from('store_products')
        .select('id, name, description, price_brl, price_usdt, category, image_url, stock_quantity, manual_delivery, slug, promotional_price_usdt, promotion_active, seller_id')
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (error) return;

      // Load seller names for seller products
      const sellerIds = ([...new Set((data || []).map(p => p.seller_id).filter(Boolean))] as string[]);
      const sellerMap: Record<string, { name: string; slug: string | null }> = {};
      if (sellerIds.length > 0) {
        const { data: sellers } = await supabase
          .from('profiles')
          .select('id, full_name, seller_slug')
          .in('id', sellerIds);
        for (const s of sellers || []) {
          sellerMap[s.id] = { name: s.full_name || 'Vendedor', slug: s.seller_slug };
        }
      }

      const enriched = (data || []).map(p => ({
        ...p,
        seller_name: p.seller_id ? sellerMap[p.seller_id]?.name || null : null,
        seller_slug: p.seller_id ? sellerMap[p.seller_id]?.slug || null : null,
      }));

      const sorted = enriched.sort((a, b) => {
        const aAvail = a.manual_delivery || a.stock_quantity > 0;
        const bAvail = b.manual_delivery || b.stock_quantity > 0;
        if (aAvail && !bAvail) return -1;
        if (!aAvail && bAvail) return 1;
        return 0;
      });
      setProducts(sorted);
    } catch { /* ignore */ }
    finally { setProductsLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors overflow-x-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 animate-grid-glow">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(59, 130, 246, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(59, 130, 246, 0.08) 1px, transparent 1px)`,
              backgroundSize: '60px 60px'
            }}
          />
        </div>
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-400 dark:bg-blue-300 rounded-full animate-particle-drift" style={{ animationDelay: '0s' }}></div>
        <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-purple-400 dark:bg-purple-300 rounded-full animate-particle-drift-2" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-blue-400 dark:bg-blue-300 rounded-full animate-particle-drift-3" style={{ animationDelay: '4s' }}></div>
        <div className="absolute top-1/2 right-1/3 w-1.5 h-1.5 bg-purple-400 dark:bg-purple-300 rounded-full animate-particle-drift" style={{ animationDelay: '3s' }}></div>
        <div className="absolute bottom-1/4 right-1/4 w-2 h-2 bg-blue-400 dark:bg-blue-300 rounded-full animate-particle-drift-2" style={{ animationDelay: '5s' }}></div>
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200/20 dark:border-gray-700/20 px-4 sm:px-6 lg:px-8 py-4 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between relative">
          {affiliateCode && (
            <div className="absolute -top-10 left-0 right-0 bg-gradient-to-r from-green-500 to-blue-500 text-white text-center py-2 z-20">
              <p className="text-sm font-medium">
                {t.language === 'pt' ? 'Voce foi convidado por um amigo! Cadastre-se e ganhe beneficios exclusivos!' :
                 t.language === 'en' ? 'You were invited by a friend! Sign up and get exclusive benefits!' :
                 'Fuiste invitado por un amigo! Registrate y obten beneficios exclusivos!'}
              </p>
            </div>
          )}

          <div className="flex items-center space-x-3">
            {storeConfig?.store_logo_url ? (
              <img src={storeConfig.store_logo_url} alt="Logo" className="h-8 w-8 object-cover rounded-lg"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : null}
            <div className={`bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg ${storeConfig?.store_logo_url ? 'hidden' : ''}`}>
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {storeConfig?.store_name || 'StreamManager'}
            </h1>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-3">
            <button onClick={toggleTheme} className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <button onClick={onGetStarted} className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
              <LogIn className="h-4 w-4 mr-2" />
              <span>{t.language === 'pt' ? 'Entrar' : t.language === 'en' ? 'Sign In' : 'Iniciar Sesion'}</span>
            </button>
            <LanguageSelector />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsMobileMenuOpen(!isMobileMenuOpen); }}
            className="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <>
            <div className="md:hidden fixed inset-0 bg-gray-600 bg-opacity-50 backdrop-blur-sm z-40 top-[60px]"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsMobileMenuOpen(false); }}
            />
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
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <LanguageSelector />
                </div>
              </div>
            </div>
          </>
        )}
      </header>

      {/* Rotating Banner Carousel */}
      {banners.length > 0 && (
        <section className="relative z-10 px-4 sm:px-6 lg:px-8 pb-8 pt-20 sm:pt-24">
          <div className="max-w-7xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl h-48 sm:h-64 lg:h-80 group">
              {banners.map((banner, idx) => (
                <div key={banner.id}
                  className={`absolute inset-0 transition-all duration-700 ${idx === currentBanner ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'}`}
                >
                  <div className="absolute inset-0" style={{ backgroundColor: banner.bg_color }} />
                  {banner.image_url && (
                    <img src={banner.image_url} alt={banner.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-40"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div className={`relative h-full flex flex-col justify-center px-6 sm:px-12 lg:px-16 ${
                      banner.text_position === 'center' ? 'items-center text-center' :
                      banner.text_position === 'right' ? 'items-end text-right ml-auto' : 'items-start text-left'
                    }`}
                    style={{ color: banner.text_color }}
                  >
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 drop-shadow-lg">{banner.title}</h2>
                    {banner.subtitle && (
                      <p className="text-sm sm:text-base lg:text-lg opacity-90 mb-4 max-w-lg drop-shadow-md">{banner.subtitle}</p>
                    )}
                    {banner.link_url && (
                      <a href={banner.link_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 transition-all hover:scale-105">
                        {banner.link_text || 'Ver mais'}
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {banners.length > 1 && (
                <>
                  <button onClick={() => setCurrentBanner(prev => (prev - 1 + banners.length) % banners.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={() => setCurrentBanner(prev => (prev + 1) % banners.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                    {banners.map((_, idx) => (
                      <button key={idx} onClick={() => setCurrentBanner(idx)}
                        className={`h-2 rounded-full transition-all ${idx === currentBanner ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/70'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Category Filter Bar */}
      <section className="sticky top-[60px] z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-y border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 overflow-x-auto py-3 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {categories.map(({ key, label, icon: Icon, color, count }) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                  selectedCategory === key
                    ? `${color.activeBg} ${color.activeText} shadow-md scale-105`
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:scale-105'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{label}</span>
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    selectedCategory === key
                      ? `${color.badgeActive}`
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Store Products Section */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-16 lg:py-20 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3">
              {t.language === 'pt' ? 'Nossos Produtos' : t.language === 'en' ? 'Our Products' : 'Nuestros Productos'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              {t.language === 'pt' ? 'Confira nossos produtos disponiveis com os melhores precos' : t.language === 'en' ? 'Check out our available products at the best prices' : 'Descubre nuestros productos disponibles con los mejores precios'}
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto mb-10">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t.language === 'pt' ? 'Buscar produtos...' : t.language === 'en' ? 'Search products...' : 'Buscar productos...'}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {productsLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t.language === 'pt' ? 'Nenhum produto disponivel no momento' : t.language === 'en' ? 'No products available at the moment' : 'No hay productos disponibles en este momento'}</p>
            </div>
          ) : (() => {
            const filtered = products.filter(p => {
              const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
              const matchesSearch = !searchQuery ||
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.category.toLowerCase().includes(searchQuery.toLowerCase());
              return matchesCategory && matchesSearch;
            });
            return filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t.language === 'pt' ? 'Nenhum produto encontrado para sua busca' : t.language === 'en' ? 'No products found for your search' : 'No se encontraron productos para tu busqueda'}</p>
              </div>
            ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                {filtered.map(product => {
                  const available = product.manual_delivery || product.stock_quantity > 0;
                  const hasPromo = product.promotion_active && product.promotional_price_usdt;
                  return (
                    <div key={product.id} onClick={() => {
                      window.location.hash = `product/${product.id}`;
                    }}
                      className="group relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer border border-gray-200 dark:border-gray-700 hover:-translate-y-1">
                      <div className="relative aspect-video overflow-hidden bg-gray-100 dark:bg-gray-700">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                          </div>
                        )}
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-xs font-medium bg-black/50 backdrop-blur-sm text-white capitalize">{product.category}</span>
                        {!available && (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-xs font-medium bg-red-500/80 backdrop-blur-sm text-white">
                            {t.language === 'pt' ? 'Esgotado' : t.language === 'en' ? 'Sold Out' : 'Agotado'}
                          </span>
                        )}
                        {available && product.stock_quantity > 0 && product.stock_quantity <= 5 && (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-xs font-medium bg-orange-500/80 backdrop-blur-sm text-white">
                            {t.language === 'pt' ? `Restam ${product.stock_quantity}` : t.language === 'en' ? `${product.stock_quantity} left` : `Quedan ${product.stock_quantity}`}
                          </span>
                        )}
                      </div>
                      <div className="p-3 lg:p-4">
                        <h3 className="font-bold text-sm lg:text-base text-gray-900 dark:text-white mb-1 line-clamp-1">{product.name}</h3>
                        {product.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{product.description}</p>
                        )}
                        <div className="flex items-baseline gap-2">
                          {hasPromo ? (
                            <>
                              <span className="text-lg lg:text-xl font-bold text-red-500">{formatPrice(Number(product.promotional_price_usdt))}</span>
                              <span className="text-xs text-gray-400 line-through">{formatPrice(Number(product.price_usdt))}</span>
                            </>
                          ) : (
                            <span className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">{formatPrice(Number(product.price_usdt))}</span>
                          )}
                        </div>
                        {product.seller_name && (
                          <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <Store className="h-3 w-3" />
                            <span className="truncate">{product.seller_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-center mt-8">
                <button onClick={onGetStarted}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all hover:scale-105 shadow-lg shadow-blue-500/30">
                  {t.language === 'pt' ? 'Entrar para Comprar' : t.language === 'en' ? 'Sign In to Buy' : 'Iniciar Sesion para Comprar'}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </>
            );
          })()}
        </div>
      </section>

      {/* Invite Sellers Section */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-8 lg:p-12 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            </div>
            <div className="relative">
              <div className="inline-flex items-center justify-center p-3 bg-white/20 backdrop-blur-sm rounded-2xl mb-4">
                <UserCheck className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3">
                {t.language === 'pt' ? 'Seja um Vendedor' : t.language === 'en' ? 'Become a Seller' : 'Conviertete en Vendedor'}
              </h2>
              <p className="text-base sm:text-lg opacity-90 mb-6 max-w-2xl">
                {t.language === 'pt' ? 'Tem produtos para vender? Crie sua conta de vendedor e comece a vender na nossa plataforma hoje mesmo. Cadastre-se e comece a ganhar!' :
                 t.language === 'en' ? 'Have products to sell? Create your seller account and start selling on our platform today. Sign up and start earning!' :
                 'Tienes productos para vender? Crea tu cuenta de vendedor y empieza a vender en nuestra plataforma hoy mismo. Registrate y empieza a ganar!'}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={onGetStarted}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-emerald-700 hover:bg-emerald-50 rounded-xl font-bold transition-all hover:scale-105 shadow-lg">
                  {t.language === 'pt' ? 'Cadastrar como Vendedor' : t.language === 'en' ? 'Register as Seller' : 'Registrarse como Vendedor'}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => { setShowLoginModal(false); setSelectedProduct(null); }}
        selectedProduct={selectedProduct}
        onLoginSuccess={onGetStarted}
      />

      {/* Footer */}
      <Footer />
    </div>
  );
}
