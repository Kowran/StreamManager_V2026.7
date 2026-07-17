import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { CreditCard, ArrowRight, CheckCircle, Globe, MessageCircle, Mail, Phone, MapPin, LogIn, Sun, Moon, Menu, X, ChevronLeft, ChevronRight, ChevronDown, Package, UserCheck, Search, LayoutGrid, Clapperboard, Code, KeyRound, Music, Gamepad2, Shield, Gift, BookOpen, Headphones, Smartphone, Server, Zap, Star, Tag, Store, Coins, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { LanguageSelector } from './LanguageSelector';
import { useTheme } from './ThemeProvider';
import { supabase, StoreProduct, PrimaryCategory, PRIMARY_CATEGORIES } from '../lib/supabase';
import { LoginModal } from './LoginModal';
import { Footer } from './Footer';
import { ProductRow } from './ProductRow';
import { Shuffle, TrendingUp, FolderTree, Eye } from 'lucide-react';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';

interface LandingPageProps {
  onGetStarted: () => void;
  onSellerRecruitment?: () => void;
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

interface SiteSettings {
  site_name?: string;
  header_logo_url?: string;
  footer_logo_url?: string;
}

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  image_url_mobile: string | null;
  image_url_desktop: string | null;
  link_url: string | null;
  link_text: string | null;
  bg_color: string;
  text_color: string;
  text_position: string;
  image_clickable: boolean;
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
  seller_avatar?: string | null;
}

export function LandingPage({ onGetStarted, onSellerRecruitment }: LandingPageProps) {
  const { t, language } = useLanguage();
  const { formatPrice } = useCurrency();
  // Rendered before rest of component when a product is selected
  // (see early return below)
  const { theme, toggleTheme } = useTheme();
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [productCategories, setProductCategories] = useState<any[]>([]);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const categoriesScrollRef = useRef<HTMLDivElement>(null);

  const scrollCategories = useCallback((dir: 'left' | 'right') => {
    const el = categoriesScrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector('[data-cat-card]')?.getBoundingClientRect().width ?? 120;
    const gap = 12;
    const scrollAmount = Math.max(cardWidth + gap, 120);
    el.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStartX.current === null || touchEndX.current === null || banners.length === 0) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        setCurrentBanner(prev => (prev + 1) % banners.length);
      } else {
        setCurrentBanner(prev => (prev - 1 + banners.length) % banners.length);
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
  }, [banners.length]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [bestSellers, setBestSellers] = useState<StoreProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { getRecentlyViewedProducts, trackView } = useRecentlyViewed();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPrimaryCategory, setSelectedPrimaryCategory] = useState<'all' | PrimaryCategory>('all');
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);

  const primaryCategoryConfig: Record<PrimaryCategory, { icon: LucideIcon; label: string; color: { activeBg: string; activeText: string; badgeActive: string } }> = {
    account: { icon: UserCheck, label: language === 'pt' ? 'Contas' : language === 'en' ? 'Accounts' : 'Cuentas', color: { activeBg: 'bg-indigo-500', activeText: 'text-white', badgeActive: 'bg-indigo-600 text-white' } },
    item: { icon: Package, label: language === 'pt' ? 'Itens' : 'Items', color: { activeBg: 'bg-emerald-500', activeText: 'text-white', badgeActive: 'bg-emerald-600 text-white' } },
    mobile_recharge: { icon: Smartphone, label: language === 'pt' ? 'Recarga' : language === 'en' ? 'Recharge' : 'Recarga', color: { activeBg: 'bg-teal-500', activeText: 'text-white', badgeActive: 'bg-teal-600 text-white' } },
    game: { icon: Gamepad2, label: language === 'pt' ? 'Jogos' : language === 'en' ? 'Games' : 'Juegos', color: { activeBg: 'bg-orange-500', activeText: 'text-white', badgeActive: 'bg-orange-600 text-white' } },
    gift_card: { icon: Gift, label: 'Gift Cards', color: { activeBg: 'bg-pink-500', activeText: 'text-white', badgeActive: 'bg-pink-600 text-white' } },
    top_up: { icon: Coins, label: 'Top-Up', color: { activeBg: 'bg-amber-500', activeText: 'text-white', badgeActive: 'bg-amber-600 text-white' } },
  };

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
    loadProductCategories();
  }, []);

  async function loadProductCategories() {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name, slug, image_url, search_keywords, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (!error && data) setProductCategories(data);
    } catch { /* ignore */ }
  }

  // Shuffle products for "recommended" row — stable shuffle to avoid recompute on every render
  const recommendedProducts = useMemo(() => {
    const available = products.filter(p => p.manual_delivery || p.stock_quantity > 0);
    const shuffled = [...available];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 20);
  }, [products]);

  // Products grouped by category for the "by category" rows
  const productsByCategory = useMemo(() => {
    const groups: Record<string, StoreProduct[]> = {};
    products.forEach(p => {
      const cat = p.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });
    return Object.entries(groups)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([cat, items]) => ({ category: cat, products: items.slice(0, 20) }));
  }, [products]);

  const recentlyViewedProducts = useMemo(() => {
    return getRecentlyViewedProducts(products).slice(0, 20);
  }, [products, getRecentlyViewedProducts]);

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
      const [storeRes, siteRes] = await Promise.all([
        supabase.from('system_config').select('value').eq('key', 'store_config').maybeSingle(),
        supabase.from('system_config').select('value').eq('key', 'site_settings').maybeSingle(),
      ]);
      if (storeRes.error && storeRes.error.code !== 'PGRST116') throw storeRes.error;
      if (siteRes.error && siteRes.error.code !== 'PGRST116') throw siteRes.error;
      setStoreConfig(storeRes.data?.value || null);
      setSiteSettings(siteRes.data?.value || null);
    } catch (error) {
      console.error('Error loading store config:', error);
    }
  }

  async function loadBanners() {
    try {
      const { data, error } = await supabase
        .from('landing_banners')
        .select('id, title, subtitle, image_url, image_url_mobile, image_url_desktop, link_url, link_text, bg_color, text_color, text_position, image_clickable')
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
        .select('id, name, description, price_brl, price_usdt, category, primary_category, image_url, stock_quantity, manual_delivery, slug, promotional_price_usdt, promotion_active, seller_id')
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (error) return;

      // Load seller names for seller products
      const sellerIds = ([...new Set((data || []).map(p => p.seller_id).filter(Boolean))] as string[]);
      const sellerMap: Record<string, { name: string; slug: string | null; avatar: string | null }> = {};
      if (sellerIds.length > 0) {
        const { data: sellers } = await supabase
          .from('profiles')
          .select('id, full_name, seller_slug, username, avatar_url')
          .in('id', sellerIds);
        for (const s of sellers || []) {
          sellerMap[s.id] = { name: s.full_name || s.username || s.seller_slug || 'Vendedor', slug: s.seller_slug, avatar: s.avatar_url || null };
        }
      }

      const enriched = (data || []).map(p => ({
        ...p,
        seller_name: p.seller_id ? sellerMap[p.seller_id]?.name || null : null,
        seller_slug: p.seller_id ? sellerMap[p.seller_id]?.slug || null : null,
        seller_avatar: p.seller_id ? sellerMap[p.seller_id]?.avatar || null : null,
      }));

      const sorted = enriched.sort((a, b) => {
        const aAvail = a.manual_delivery || a.stock_quantity > 0;
        const bAvail = b.manual_delivery || b.stock_quantity > 0;
        if (aAvail && !bAvail) return -1;
        if (!aAvail && bAvail) return 1;
        return 0;
      });
      setProducts(sorted);

      // Load best sellers from store_orders (limited to recent 500 for performance)
      try {
        const { data: orders } = await supabase
          .from('store_orders')
          .select('product_id')
          .in('status', ['delivered', 'paid', 'completed'])
          .order('created_at', { ascending: false })
          .limit(500);
        if (orders && orders.length > 0) {
          const salesCount: Record<string, number> = {};
          orders.forEach(o => {
            if (o.product_id) salesCount[o.product_id] = (salesCount[o.product_id] || 0) + 1;
          });
          const ranked = enriched
            .map(p => ({ ...p, _sales: salesCount[p.id] || 0 }))
            .filter(p => p._sales > 0)
            .sort((a, b) => (b as any)._sales - (a as any)._sales)
            .slice(0, 20);
          setBestSellers(ranked);
        }
      } catch { /* ignore */ }
    } catch { /* ignore */ }
    finally { setProductsLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors overflow-x-hidden">
      {/* Static Background (optimized: removed animated particles for performance) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(59, 130, 246, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(59, 130, 246, 0.06) 1px, transparent 1px)`,
              backgroundSize: '60px 60px'
            }}
          />
        </div>
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
            {(siteSettings?.header_logo_url || storeConfig?.store_logo_url) ? (
              <img src={siteSettings?.header_logo_url || storeConfig?.store_logo_url} alt="Logo" className="h-8 w-8 object-cover rounded-lg"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : null}
            <div className={`bg-gradient-to-r from-blue-500 to-cyan-600 p-2 rounded-lg ${(siteSettings?.header_logo_url || storeConfig?.store_logo_url) ? 'hidden' : ''}`}>
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {siteSettings?.site_name || storeConfig?.store_name || 'StreamManager'}
            </h1>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-3">
            <button onClick={toggleTheme} className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            {onSellerRecruitment && (
              <button onClick={onSellerRecruitment} className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-sm font-medium rounded-lg transition-all hover:scale-105 shadow-md">
                <Store className="h-4 w-4 mr-2" />
                <span>{t.language === 'pt' ? 'Vender' : t.language === 'en' ? 'Sell' : 'Vender'}</span>
              </button>
            )}
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
                {onSellerRecruitment && (
                  <button onClick={() => { onSellerRecruitment(); setIsMobileMenuOpen(false); }}
                    className="w-full flex items-center justify-center p-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-medium rounded-lg transition-all">
                    <Store className="h-5 w-5 mr-2" />
                    <span>{t.language === 'pt' ? 'Seja um Vendedor' : t.language === 'en' ? 'Become a Seller' : 'Ser Vendedor'}</span>
                  </button>
                )}
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
            <div
        className="relative rounded-2xl overflow-hidden shadow-2xl w-full max-w-[800px] mx-auto aspect-[800/300] sm:max-w-[1000px] sm:aspect-[1000/400] group select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
              {banners.map((banner, idx) => {
                const bannerImage = banner.image_url_mobile || banner.image_url_desktop || banner.image_url;
                const isClickable = banner.image_clickable && banner.link_url;
                const slideContent = (
                  <>
                    <div className="absolute inset-0" style={{ backgroundColor: banner.bg_color === 'transparent' ? 'transparent' : banner.bg_color }} />
                    {banner.image_url_mobile && (
                      <img src={banner.image_url_mobile} alt={banner.title}
                        className={`absolute inset-0 w-full h-full object-cover sm:hidden ${banner.bg_color && banner.bg_color !== 'transparent' ? 'opacity-40' : 'opacity-100'}`}
                        loading="eager"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    {banner.image_url_desktop && (
                      <img src={banner.image_url_desktop} alt={banner.title}
                        className={`absolute inset-0 w-full h-full object-cover hidden sm:block ${banner.bg_color && banner.bg_color !== 'transparent' ? 'opacity-40' : 'opacity-100'}`}
                        loading="eager"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    {!banner.image_url_mobile && !banner.image_url_desktop && banner.image_url && (
                      <img src={banner.image_url} alt={banner.title}
                        className={`absolute inset-0 w-full h-full object-cover ${banner.bg_color && banner.bg_color !== 'transparent' ? 'opacity-40' : 'opacity-100'}`}
                        loading="eager"
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
                      {banner.link_url && !banner.image_clickable && (
                        <a href={banner.link_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 transition-all hover:scale-105">
                          {banner.link_text || 'Ver mais'}
                          <ArrowRight className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </>
                );
                return (
                  <div key={banner.id}
                    className={`absolute inset-0 transition-all duration-700 ${idx === currentBanner ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'}`}
                  >
                    {isClickable ? (
                      <a href={banner.link_url!} target="_blank" rel="noopener noreferrer" className="block w-full h-full cursor-pointer">
                        {slideContent}
                      </a>
                    ) : (
                      slideContent
                    )}
                  </div>
                );
              })}
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

      {/* Product Categories - Game cards */}
      {productCategories.length > 0 && (
        <section className="relative z-10 px-4 sm:px-6 lg:px-8 pb-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mb-3">
              {t.language === 'pt' ? 'Categorias de Jogos' : t.language === 'en' ? 'Game Categories' : 'Categorías de Juegos'}
            </h2>
            <div className="relative group/cat">
              <button
                onClick={() => scrollCategories('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:scale-110 transition-all opacity-80 group-hover/cat:opacity-100"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => scrollCategories('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:scale-110 transition-all opacity-80 group-hover/cat:opacity-100"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div
                ref={categoriesScrollRef}
                className="flex gap-3 overflow-x-auto scroll-smooth pb-2 -mb-2 scrollbar-hide"
              >
                {productCategories.map(cat => (
                  <button
                    key={cat.id}
                    data-cat-card
                    onClick={() => { onGetStarted(); setTimeout(() => { window.location.hash = `category/${cat.slug}`; }, 500); }}
                    className="group relative flex-shrink-0 w-[90px] sm:w-[110px] aspect-[4/5] rounded-xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 shadow-sm hover:shadow-lg hover:scale-[1.03] transition-all duration-200"
                  >
                    {cat.image_url ? (
                      <img src={cat.image_url} alt={cat.name} className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-80 transition-opacity" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Gamepad2 className="h-8 w-8 text-gray-500" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-white text-[10px] sm:text-xs font-semibold leading-tight line-clamp-2 text-center">{cat.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Payment Methods Ribbon */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 py-3 bg-white dark:bg-gray-900 border-y border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <span className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap flex-shrink-0">
              {t.language === 'pt' ? 'Pagamentos aceitos:' : t.language === 'en' ? 'Accepted payments:' : 'Pagos aceptados:'}
            </span>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {[
                { label: 'VISA', cls: 'bg-blue-600 text-white font-bold italic' },
                { label: 'Mastercard', cls: 'bg-orange-500 text-white font-semibold' },
                { label: 'Elo', cls: 'bg-yellow-500 text-black font-bold' },
                { label: 'Pix', cls: 'bg-teal-500 text-white font-bold' },
                { label: 'USDT', cls: 'bg-green-600 text-white font-bold' },
                { label: 'USDC', cls: 'bg-blue-500 text-white font-bold' },
                { label: 'Bitcoin', cls: 'bg-orange-600 text-white font-bold' },
                { label: 'ETH', cls: 'bg-indigo-600 text-white font-bold' },
                { label: 'Binance', cls: 'bg-yellow-400 text-black font-bold' },
                { label: 'PayPal', cls: 'bg-blue-700 text-white font-bold italic' },
              ].map(pm => (
                <div key={pm.label} className={pm.cls + ' px-2.5 sm:px-3 py-1 rounded-md text-[10px] sm:text-xs whitespace-nowrap shadow-sm'}>
                  {pm.label}
                </div>
              ))}
          </div>
            </div>
        </div>
      </section>

      {/* Primary Category - Square Cards */}
      <section className="relative z-30 bg-white dark:bg-gray-900 border-y border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-5">
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-1.5 sm:gap-3">
            {primaryCategories.map(({ key, label, icon: Icon, color, count }) => (
              <button
                key={key}
                onClick={() => setSelectedPrimaryCategory(key)}
                className={`relative flex flex-col items-center justify-center gap-1 p-1.5 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all duration-200 group ${
                  selectedPrimaryCategory === key
                    ? `${color.activeBg} ${color.activeText} shadow-md sm:shadow-lg scale-[1.03] border-transparent`
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm sm:hover:shadow-md hover:scale-[1.02]'
                }`}
              >
                <div className={`p-1 sm:p-2.5 rounded-lg sm:rounded-xl transition-colors ${
                  selectedPrimaryCategory === key
                    ? 'bg-white/20'
                    : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'
                }`}>
                  <Icon className="h-4 w-4 sm:h-7 sm:w-7 flex-shrink-0" />
                </div>
                <span className="text-[10px] sm:text-sm font-bold text-center leading-tight">{label}</span>
                {count > 0 && (
                  <span className={`absolute top-1 right-1 sm:top-1.5 sm:right-1.5 text-[9px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 rounded-full ${
                    selectedPrimaryCategory === key
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

          {/* Search Bar + Secondary Filter Dropdown */}
          <div className="max-w-3xl mx-auto mb-8">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Search */}
              <div className="relative flex-1">
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

              {/* Secondary Filter Dropdown */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setShowSecondaryFilters(!showSecondaryFilters)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 rounded-xl border shadow-sm transition-all text-sm font-semibold whitespace-nowrap ${
                    showSecondaryFilters || selectedCategory !== 'all'
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">
                    {t.language === 'pt' ? 'Subcategoria' : t.language === 'en' ? 'Subcategory' : 'Subcategoría'}
                  </span>
                  {selectedCategory !== 'all' && (
                    <span className="sm:hidden text-xs">●</span>
                  )}
                  <ChevronDown className={`h-4 w-4 transition-transform ${showSecondaryFilters ? 'rotate-180' : ''}`} />
                </button>
                {showSecondaryFilters && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowSecondaryFilters(false)} />
                    <div className="absolute right-0 top-full mt-2 z-40 w-56 sm:w-64 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1 max-h-80 overflow-y-auto">
                      {categories.map(({ key, label, icon: Icon, color, count }) => (
                        <button
                          key={key}
                          onClick={() => { setSelectedCategory(key); setShowSecondaryFilters(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            selectedCategory === key
                              ? `${color.activeBg} ${color.activeText} shadow-sm`
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="flex-1 text-left whitespace-nowrap">{label}</span>
                          {count > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              selectedCategory === key
                                ? color.badgeActive
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                            }`}>
                              {count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Products area - Horizontal Rows */}
          <div>
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
              const matchesPrimary = selectedPrimaryCategory === 'all' || ((p as any).primary_category || 'item') === selectedPrimaryCategory;
              const matchesSearch = !searchQuery ||
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.category.toLowerCase().includes(searchQuery.toLowerCase());
              return matchesCategory && matchesPrimary && matchesSearch;
            });

            if (filtered.length === 0) {
              return (
                <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{t.language === 'pt' ? 'Nenhum produto encontrado para sua busca' : t.language === 'en' ? 'No products found for your search' : 'No se encontraron productos para tu busqueda'}</p>
                </div>
              );
            }

            const isFiltering = selectedCategory !== 'all' || selectedPrimaryCategory !== 'all' || searchQuery;
            const handleProductClick = (product: StoreProduct) => {
              trackView(product);
              window.location.hash = `product/${product.id}`;
            };

            if (isFiltering) {
              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                    {filtered.map(product => {
                      const available = product.manual_delivery || product.stock_quantity > 0;
                      const hasPromo = product.promotion_active && product.promotional_price_usdt;
                      return (
                        <div key={product.id} onClick={() => handleProductClick(product)}
                          className="group relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer border border-gray-200 dark:border-gray-700 hover:-translate-y-1">
                          <div className="relative aspect-video overflow-hidden bg-gray-100 dark:bg-gray-700">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                loading="lazy"
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
                              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                {product.seller_avatar ? (
                                  <img src={product.seller_avatar} alt={product.seller_name} className="h-4 w-4 rounded-full object-cover flex-shrink-0" />
                                ) : (
                                  <div className="h-4 w-4 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                                    <Store className="h-2.5 w-2.5 text-white" />
                                  </div>
                                )}
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
            }

            // Default view: horizontal rows
            return (
              <>
                {/* Row 1: Recommended (random) */}
                <ProductRow
                  title={t.language === 'pt' ? 'Recomendados para Você' : t.language === 'en' ? 'Recommended for You' : 'Recomendados para Ti'}
                  subtitle={t.language === 'pt' ? 'Produtos selecionados aleatoriamente' : t.language === 'en' ? 'Randomly selected products' : 'Productos seleccionados al azar'}
                  products={recommendedProducts}
                  onProductClick={handleProductClick}
                  icon={<Shuffle className="w-5 h-5 text-blue-500" />}
                />

                {/* Row 2: Best Sellers */}
                {bestSellers.length > 0 && (
                  <ProductRow
                    title={t.language === 'pt' ? 'Mais Vendidos' : t.language === 'en' ? 'Best Sellers' : 'Más Vendidos'}
                    subtitle={t.language === 'pt' ? 'Os produtos mais populares' : t.language === 'en' ? 'Most popular products' : 'Los productos más populares'}
                    products={bestSellers}
                    onProductClick={handleProductClick}
                    icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
                  />
                )}

                {/* Row 3+: By Category */}
                {productsByCategory.map(({ category, products: catProducts }) => (
                  <ProductRow
                    key={category}
                    title={category.charAt(0).toUpperCase() + category.slice(1)}
                    products={catProducts}
                    onProductClick={handleProductClick}
                    icon={<FolderTree className="w-5 h-5 text-amber-500" />}
                  />
                ))}

                {/* Row 4: Recently Viewed */}
                {recentlyViewedProducts.length > 0 && (
                  <ProductRow
                    title={t.language === 'pt' ? 'Vistos Recentemente' : t.language === 'en' ? 'Recently Viewed' : 'Vistos Recientemente'}
                    products={recentlyViewedProducts}
                    onProductClick={handleProductClick}
                    icon={<Eye className="w-5 h-5 text-purple-500" />}
                  />
                )}

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
