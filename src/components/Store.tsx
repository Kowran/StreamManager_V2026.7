import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ShoppingCart, Package, Star, DollarSign, Search, Check, AlertCircle, CreditCard, Loader, X, Truck, ArrowRight, ChevronLeft, ChevronRight, Eye, Image as ImageIcon, Store as StoreIcon, LayoutGrid, Clapperboard, Code, KeyRound, Music, Gamepad2, Shield, Gift, BookOpen, UserCheck, MessageCircle, Zap, TrendingUp, Smartphone, Coins, SlidersHorizontal, ChevronDown, Shuffle, FolderTree, type LucideIcon } from 'lucide-react';
import { supabase, StoreProduct, PrimaryCategory, PRIMARY_CATEGORIES } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useCurrency } from './CurrencyProvider';
import { useLanguage } from './LanguageProvider';
import { useNotificationContext } from './NotificationProvider';
import { StripePaymentModal } from './StripePaymentModal';
import { PayPalPaymentModal } from './PayPalPaymentModal';
import { MercadoPagoPaymentModal } from './MercadoPagoPaymentModal';
import { WhatsAppPaymentModal } from './WhatsAppPaymentModal';
import { CryptomusPaymentModal } from './CryptomusPaymentModal';
import { BinancePaymentModal } from './BinancePaymentModal';
import { ProductRatingsDisplay } from './ProductRatingsDisplay';
import { PublicSellerProfile } from './PublicSellerProfile';
import { PurchaseConfirmModal } from './PurchaseConfirmModal';
import { ProductRatingModal } from './ProductRatingModal';
import { SellerRequestForm } from './SellerRequestForm';
import { SMMPanel } from './SMMPanel';
import { ProductRow } from './ProductRow';
import { LoginModal } from './LoginModal';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';

interface UserCredit {
  balance: number;
  total_recharged: number;
  total_spent: number;
  frozen?: boolean;
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  description: string;
  enabled: boolean;
  fees?: string;
  processing_time?: string;
}

interface ProductWithSeller extends StoreProduct {
  seller_info?: {
    business_name: string;
    sales_count: number;
    seller_slug?: string;
    avatar_url?: string | null;
    average_rating?: number;
    rating_count?: number;
  };
}

interface StoreProps {
  onNavigate?: (tab: string, opts?: { presetAmount?: number }) => void;
}

export function Store({ onNavigate }: StoreProps = {}) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { addNotification } = useNotificationContext();
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<ProductWithSeller[]>([]);
  const [bestSellers, setBestSellers] = useState<ProductWithSeller[]>([]);
  const [userCredit, setUserCredit] = useState<UserCredit | null>(null);
  const [cashbackBalance, setCashbackBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const navigateToSearch = (q: string) => {
    const query = q.trim();
    if (!query) return;
    window.history.pushState(null, '', `/search/${encodeURIComponent(query)}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  const [activeCategory, setActiveCategory] = useState('all');
  const [activePrimaryCategory, setActivePrimaryCategory] = useState<'all' | PrimaryCategory>('all');
  const [showSecondaryFilters, setShowSecondaryFilters] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithSeller | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const { trackView, getRecentlyViewedProducts } = useRecentlyViewed();
  const [purchaseAmount, setPurchaseAmount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 12;
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [purchaseSuccessData, setPurchaseSuccessData] = useState<{productName: string; price: number; orderId: string} | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [showSellerProfile, setShowSellerProfile] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState<any>(null);
  const [productVariations, setProductVariations] = useState<any[]>([]);
  const [productToConfirm, setProductToConfirm] = useState<ProductWithSeller | null>(null);
  const [banners, setBanners] = useState<any[]>([]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [pendingRating, setPendingRating] = useState<{ productId: string; productName: string } | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showSellerForm, setShowSellerForm] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [hasRequestedSeller, setHasRequestedSeller] = useState(false);
  const [productCategories, setProductCategories] = useState<any[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const categoriesScrollRef = useRef<HTMLDivElement>(null);

  const scrollCategories = useCallback((direction: 'left' | 'right') => {
    if (categoriesScrollRef.current) {
      const scrollAmount = 300;
      categoriesScrollRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    loadStoreData();
    loadBanners();
    loadProductCategories();
    if (user) {
      loadUserCredit();
      loadUserProfile();
    }
  }, [user]);

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

  async function loadUserProfile() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      setUserRole(data?.role || null);

      const { data: reqData } = await supabase
        .from('seller_requests')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      setHasRequestedSeller(!!reqData);
    } catch {
      setUserRole(null);
    }
  }

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBanner(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  async function loadStoreData() {
    try {
      const { data, error } = await supabase
        .from('store_products')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch admin profile once
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id, full_name, seller_slug')
        .eq('role', 'admin')
        .maybeSingle();

      // Cache seller profiles to avoid duplicate queries for the same seller
      const sellerProfileCache: Record<string, { full_name: string; seller_slug: string; username: string; avatar_url: string | null }> = {};
      // Cache seller ratings to avoid duplicate queries
      const sellerRatingCache: Record<string, { average_rating: number; rating_count: number }> = {};

      async function getSellerRating(sellerId: string): Promise<{ average_rating: number; rating_count: number }> {
        if (sellerRatingCache[sellerId]) return sellerRatingCache[sellerId];
        const { data: ratings } = await supabase
          .from('product_ratings')
          .select('rating, product_id')
          .in('product_id', (data || []).filter(p => p.seller_id === sellerId).map(p => p.id));
        const count = ratings?.length || 0;
        const avg = count > 0 ? ratings!.reduce((s: number, r: any) => s + r.rating, 0) / count : 0;
        const result = { average_rating: avg, rating_count: count };
        sellerRatingCache[sellerId] = result;
        return result;
      }

      const productsWithSellers = await Promise.all(
        (data || []).map(async (product) => {
          // Fetch per-product sales count
          const { data: productSalesCount } = await supabase.rpc('get_product_sales_count', { product_uuid: product.id });
          const salesCount = Number(productSalesCount) || 0;

          // Fetch total stock (includes variation stock)
          let totalStock = product.stock_quantity;
          if (!product.manual_delivery && !(product as any).account_recharge) {
            const { data: stockCount } = await supabase.rpc('get_product_total_stock', { p_product_id: product.id });
            if (stockCount !== null && stockCount !== undefined) {
              totalStock = stockCount;
            }
          }

          if (product.seller_id) {
            let sellerData: { full_name: string; seller_slug: string; username: string; avatar_url: string | null } | null = null;
            if (sellerProfileCache[product.seller_id]) {
              sellerData = sellerProfileCache[product.seller_id];
            } else {
              const { data: sd } = await supabase
                .from('profiles')
                .select('full_name, seller_slug, username, avatar_url')
                .eq('id', product.seller_id)
                .maybeSingle();
              sellerData = sd;
              if (sd) {
                sellerProfileCache[product.seller_id] = { full_name: sd.full_name, seller_slug: sd.seller_slug, username: sd.username, avatar_url: sd.avatar_url };
              }
            }
            const sellerRating = await getSellerRating(product.seller_id);
            return {
              ...product,
              stock_quantity: totalStock,
              seller_info: {
                business_name: sellerData?.full_name || sellerData?.username || sellerData?.seller_slug || 'Vendedor',
                sales_count: salesCount,
                seller_slug: sellerData?.seller_slug,
                avatar_url: sellerData?.avatar_url,
                average_rating: sellerRating.average_rating,
                rating_count: sellerRating.rating_count,
              }
            };
          }

          const adminRating = await getSellerRating(adminProfile?.id || '');
          return {
            ...product,
            stock_quantity: totalStock,
            seller_id: adminProfile?.id ?? null,
            seller_info: {
              business_name: adminProfile?.full_name || 'Admin',
              sales_count: salesCount,
              seller_slug: adminProfile?.seller_slug,
              avatar_url: null,
              average_rating: adminRating.average_rating,
              rating_count: adminRating.rating_count,
            }
          };
        })
      );

      const sortedProducts = productsWithSellers.sort((a, b) => {
        const aAvailable = a.manual_delivery || a.stock_quantity > 0;
        const bAvailable = b.manual_delivery || b.stock_quantity > 0;

        if (aAvailable && !bAvailable) return -1;
        if (!aAvailable && bAvailable) return 1;

        if (a.manual_delivery && !b.manual_delivery) return -1;
        if (!a.manual_delivery && b.manual_delivery) return 1;

        return b.stock_quantity - a.stock_quantity;
      });

      setProducts(sortedProducts);

      // Load best sellers from store_orders
      try {
        const { data: orders } = await supabase
          .from('store_orders')
          .select('product_id')
          .in('status', ['delivered', 'paid', 'completed']);
        if (orders && orders.length > 0) {
          const salesCount: Record<string, number> = {};
          orders.forEach(o => {
            if (o.product_id) salesCount[o.product_id] = (salesCount[o.product_id] || 0) + 1;
          });
          const ranked = sortedProducts
            .map(p => ({ ...p, _sales: salesCount[p.id] || 0 }))
            .filter(p => p._sales > 0)
            .sort((a, b) => (b as any)._sales - (a as any)._sales)
            .slice(0, 20);
          setBestSellers(ranked);
        }
      } catch { /* ignore */ }
    } catch (error) {
      console.error('Error loading store data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadUserCredit() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance, total_recharged, total_spent, frozen')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setUserCredit(data || { balance: 0, total_recharged: 0, total_spent: 0, frozen: false });

      const { data: smCredits, error: smError } = await supabase
        .from('user_sm_credits')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!smError && smCredits) {
        setCashbackBalance(smCredits.balance || 0);
      }
    } catch (error) {
      console.error('Error loading user credit:', error);
      setUserCredit({ balance: 0, total_recharged: 0, total_spent: 0, frozen: false });
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

  async function checkPendingRatings(): Promise<boolean> {
    if (!user) return false;
    try {
      const { data: orders, error } = await supabase
        .from('store_orders')
        .select('id, product_id, has_rated')
        .eq('user_id', user.id)
        .in('status', ['delivered', 'paid'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (error || !orders || orders.length === 0) return false;

      const lastOrder = orders[0];
      if (!lastOrder.product_id) return false;
      if (lastOrder.has_rated) return false;

      const { data: rating } = await supabase
        .from('product_ratings')
        .select('id')
        .eq('user_id', user.id)
        .eq('order_id', lastOrder.id)
        .limit(1);

      if (!rating || rating.length === 0) {
        const { data: prod } = await supabase
          .from('store_products')
          .select('name')
          .eq('id', lastOrder.product_id)
          .single();
        setPendingRating({ productId: lastOrder.product_id, productName: prod?.name || 'Produto', orderId: lastOrder.id });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  function handlePurchase(product: ProductWithSeller) {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!userCredit) return;

    if (userCredit.frozen) {
      alert(t.language === 'pt' ? 'Seu saldo está congelado. Entre em contato com o suporte.' :
        t.language === 'en' ? 'Your balance is frozen. Contact support.' :
        'Tu saldo está congelado. Contacta con soporte.');
      return;
    }

    if (product.seller_id && product.seller_id === user.id) {
      alert(t.language === 'pt' ? 'Você não pode comprar seu próprio produto.' :
        t.language === 'en' ? 'You cannot purchase your own product.' :
        'No puedes comprar tu propio producto.');
      return;
    }

    checkPendingRatings().then(hasPending => {
      if (hasPending) {
        setShowRatingModal(true);
        return;
      }

      setProductToConfirm(product);
      setSelectedVariation(null);
      setShowConfirmModal(true);
    });
  }

  async function handleConfirmPurchase(couponCode?: string, rechargeData?: { email: string; password: string; extra_data: string }, useCashback?: boolean, quantity?: number, variationId?: string | null) {
    if (!user || !userCredit || !productToConfirm) return;

    const product = productToConfirm;

    setPurchasing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-store-purchase`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: product.id,
          quantity: quantity || 1,
          coupon_code: couponCode,
          recharge_data: rechargeData,
          use_cashback: useCashback || false,
          variation_id: variationId || selectedVariation?.id || null,
        })
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.error || 'Erro ao processar compra';
        const detailMsg = result.details ? `\n${result.details}` : '';
        throw new Error(errorMsg + detailMsg);
      }

      const finalPrice = result.final_price ?? product.price_usdt;
      const discountAmount = result.discount_amount ?? 0;

      // Close confirmation modal
      setShowConfirmModal(false);
      setProductToConfirm(null);

      // Reload data
      await loadStoreData();
      await loadUserCredit();

      // Show success notification
      await addNotification({
        type: 'delivery',
        title: '🎉 Compra Realizada!',
        message: `Você comprou "${product.name}" com sucesso! Verifique suas compras para acessar o produto.`,
        data: {
          product_name: product.name,
          amount_paid: finalPrice,
          order_id: result.order_id
        },
        priority: 'high'
      });

      // Show success modal
      setPurchaseSuccessData({
        productName: product.name,
        price: finalPrice,
        orderId: result.order_id
      });
      setShowSuccessModal(true);

    } catch (error) {
      console.error('Error processing purchase:', error);
      // Refresh store data to update stock quantities and product availability
      await loadStoreData();
      alert(error instanceof Error ? error.message : 'Erro ao processar compra');
    } finally {
      setPurchasing(false);
    }
  }

  const primaryCategoryConfig: Record<PrimaryCategory, { icon: LucideIcon; label: string; color: { activeBg: string; activeText: string; badgeActive: string } }> = {
    account: { icon: UserCheck, label: language === 'pt' ? 'Contas' : language === 'en' ? 'Accounts' : 'Cuentas', color: { activeBg: 'bg-indigo-500', activeText: 'text-white', badgeActive: 'bg-indigo-600 text-white' } },
    item: { icon: Package, label: language === 'pt' ? 'Itens' : 'Items', color: { activeBg: 'bg-emerald-500', activeText: 'text-white', badgeActive: 'bg-emerald-600 text-white' } },
    mobile_recharge: { icon: Smartphone, label: language === 'pt' ? 'Recarga' : language === 'en' ? 'Recharge' : 'Recarga', color: { activeBg: 'bg-teal-500', activeText: 'text-white', badgeActive: 'bg-teal-600 text-white' } },
    game: { icon: Gamepad2, label: language === 'pt' ? 'Jogos' : language === 'en' ? 'Games' : 'Juegos', color: { activeBg: 'bg-orange-500', activeText: 'text-white', badgeActive: 'bg-orange-600 text-white' } },
    gift_card: { icon: Gift, label: language === 'pt' ? 'Gift Cards' : 'Gift Cards', color: { activeBg: 'bg-pink-500', activeText: 'text-white', badgeActive: 'bg-pink-600 text-white' } },
    top_up: { icon: Coins, label: language === 'pt' ? 'Top-Up' : 'Top-Up', color: { activeBg: 'bg-amber-500', activeText: 'text-white', badgeActive: 'bg-amber-600 text-white' } },
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
    music: { icon: Music, label: language === 'pt' ? 'Música' : 'Music', color: { activeBg: 'bg-purple-500', activeText: 'text-white', badgeActive: 'bg-purple-600 text-white' } },
    gaming: { icon: Gamepad2, label: 'Gaming', color: { activeBg: 'bg-orange-500', activeText: 'text-white', badgeActive: 'bg-orange-600 text-white' } },
    software: { icon: Code, label: 'Software', color: { activeBg: 'bg-blue-500', activeText: 'text-white', badgeActive: 'bg-blue-600 text-white' } },
    other: { icon: Package, label: language === 'pt' ? 'Outros' : language === 'en' ? 'Other' : 'Otros', color: { activeBg: 'bg-gray-600', activeText: 'text-white', badgeActive: 'bg-gray-700 text-white' } },
  };

  const smmCategoryConfig = {
    icon: TrendingUp,
    label: language === 'pt' ? 'Redes Sociais' : language === 'en' ? 'Social Media' : 'Redes Sociales',
    color: { activeBg: 'bg-pink-500', activeText: 'text-white', badgeActive: 'bg-pink-600 text-white' },
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
      { key: 'smm', label: smmCategoryConfig.label, icon: smmCategoryConfig.icon, color: smmCategoryConfig.color, count: 0 },
      ...cats,
    ];
  }, [products, language]);

  const allProducts = [...products];
  
  const filteredProducts = allProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = activeCategory === 'all' || product.category === activeCategory;
    const matchesPrimary = activePrimaryCategory === 'all' || ((product as any).primary_category || 'item') === activePrimaryCategory;
    return matchesSearch && matchesCategory && matchesPrimary;
  });

  // Recommended products (shuffled random)
  const recommendedProducts = useMemo(() => {
    const available = products.filter(p => p.manual_delivery || p.stock_quantity > 0);
    const shuffled = [...available];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 20);
  }, [products]);

  // Products grouped by category
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

  // Recently viewed products
  const recentlyViewedProducts = useMemo(() => {
    return getRecentlyViewedProducts(products).slice(0, 20);
  }, [products, getRecentlyViewedProducts]);

  const isFiltering = activeCategory !== 'all' || activePrimaryCategory !== 'all' || searchTerm;

  const handleProductClick = useCallback((product: StoreProduct) => {
    trackView(product);
    window.history.pushState(null, '', `/product/${product.id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [trackView]);

  // Pagination logic
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  const startIndex = (currentPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeCategory, activePrimaryCategory]);


  const paymentMethods: PaymentMethod[] = [
    {
      id: 'stripe',
      name: 'Cartão de Crédito/Débito',
      icon: 'https://i.imgur.com/Un7zfmo.png',
      description: 'Visa, Mastercard, American Express',
      enabled: true,
      fees: '3.9% + $0.30',
      processing_time: 'Instantâneo'
    },
    {
      id: 'paypal',
      name: 'PayPal',
      icon: 'https://i.imgur.com/VbyIdkc.png',
      description: 'PayPal, cartões internacionais',
      enabled: true,
      fees: '10% + $0.40',
      processing_time: 'Instantâneo'
    },
    {
      id: 'mercadopago',
      name: 'PIX / Mercado Pago',
      icon: 'https://i.imgur.com/3oeBwGn.jpeg',
      description: 'PIX, cartão (Brasil)',
      enabled: true,
      fees: 'Sem taxas (PIX)',
      processing_time: 'Instantâneo'
    },
    {
      id: 'cryptomus',
      name: 'Cryptomus',
      icon: 'https://i.imgur.com/nXhq7ph.png',
      description: 'Criptomoedas diversas',
      enabled: true,
      fees: 'Sem taxas',
      processing_time: '5-15 minutos'
    },
    {
      id: 'binance',
      name: 'Binance Pay',
      icon: 'https://i.imgur.com/ylT9tJ1.png',
      description: 'Pagamento via Binance',
      enabled: true,
      fees: 'Sem taxas',
      processing_time: 'Instantâneo'
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Manual',
      icon: 'https://i.imgur.com/Ei6JERR.png',
      description: 'Atendimento personalizado',
      enabled: true,
      fees: 'Sem taxas',
      processing_time: '2-24 horas'
    }
  ];

  function handlePaymentMethodSelect(methodId: string, amount: number) {
    setSelectedPaymentMethod(methodId);
    setPurchaseAmount(amount);
    setShowPaymentModal(true);
  }

  function handlePaymentSuccess() {
    loadUserCredit();
    setShowPaymentModal(false);
    setSelectedPaymentMethod('');
    setPurchaseAmount(0);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0 overflow-x-hidden">
      {/* Header - Seller actions only */}
      <div className="flex flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {userRole === 'seller' && onNavigate ? (
            <button
              onClick={() => onNavigate('seller-store')}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 text-xs sm:text-sm font-bold whitespace-nowrap"
            >
              <StoreIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{t.language === 'pt' ? 'Minha Loja' : t.language === 'en' ? 'My Store' : 'Mi Tienda'}</span>
            </button>
          ) : userRole !== 'admin' && !hasRequestedSeller ? (
            <button
              onClick={() => setShowSellerForm(true)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 text-xs sm:text-sm font-bold whitespace-nowrap"
            >
              <StoreIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{t.language === 'pt' ? 'Ser Vendedor' : t.language === 'en' ? 'Be a Seller' : 'Ser Vendedor'}</span>
            </button>
          ) : null}
      </div>

      {/* Rotating Banner Carousel */}
      {banners.length > 0 && (
        <div className="relative rounded-2xl overflow-hidden shadow-2xl group w-full max-w-[800px] mx-auto aspect-[800/300] sm:max-w-[1920px] sm:aspect-[1920/500] select-none">
          {banners.map((banner, idx) => (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-all duration-700 ${idx === currentBanner ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'}`}
            >
              <div className="absolute inset-0" style={{ backgroundColor: banner.bg_color === 'transparent' ? 'transparent' : banner.bg_color }} />
              {banner.image_url && (
                <img
                  src={banner.image_url}
                  alt={banner.title}
                  className={`absolute inset-0 w-full h-full object-cover ${banner.bg_color && banner.bg_color !== 'transparent' ? 'opacity-40' : 'opacity-100'}`}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div
                className={`relative h-full flex flex-col justify-center px-6 sm:px-10 ${banner.text_position === 'center' ? 'items-center text-center' : banner.text_position === 'right' ? 'items-end text-right' : 'items-start text-left'}`}
                style={{ color: banner.text_color }}
              >
                <h2 className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2 drop-shadow-lg line-clamp-2">{banner.title}</h2>
                {banner.subtitle && (
                  <p className="text-xs sm:text-base opacity-90 mb-2 sm:mb-4 max-w-lg drop-shadow-md line-clamp-2">{banner.subtitle}</p>
                )}
                {banner.link_url && (
                  <a
                    href={banner.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 transition-all hover:scale-105"
                  >
                    {banner.link_text || (t.language === 'pt' ? 'Ver mais' : t.language === 'en' ? 'See more' : 'Ver más')}
                    <ArrowRight className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
          {banners.length > 1 && (
            <>
              <button
                onClick={() => setCurrentBanner(prev => (prev - 1 + banners.length) % banners.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentBanner(prev => (prev + 1) % banners.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                {banners.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentBanner(idx)}
                    className={`h-2 rounded-full transition-all ${idx === currentBanner ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/70'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Search Bar + Secondary Filter Dropdown - mobile only */}
      <div className="mb-3 sm:mb-4 lg:hidden">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search */}
          <form onSubmit={e => { e.preventDefault(); navigateToSearch(searchInput); }} className="relative flex-1">
            <button type="submit" className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
              <Search className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            <input
              type="text"
              placeholder={
                t.language === 'pt' ? 'Buscar produtos...' :
                t.language === 'en' ? 'Search products...' :
                'Buscar productos...'
              }
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all text-sm"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(''); setSearchTerm(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          {/* Secondary Filter Dropdown */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowSecondaryFilters(!showSecondaryFilters)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border shadow-sm transition-all text-sm font-semibold whitespace-nowrap ${
                showSecondaryFilters || activeCategory !== 'all'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">
                {t.language === 'pt' ? 'Subcategoria' : t.language === 'en' ? 'Subcategory' : 'Subcategoría'}
              </span>
              {activeCategory !== 'all' && (
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
                      onClick={() => { setActiveCategory(key); setShowSecondaryFilters(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeCategory === key
                          ? `${color.activeBg} ${color.activeText} shadow-sm`
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 text-left whitespace-nowrap">{label}</span>
                      {count > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          activeCategory === key
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

      {/* Primary Category - Square Cards */}
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

      {/* Horizontal product rows - shown when not filtering */}
      {/* Product Categories - Game cards carousel */}
      {!isFiltering && activeCategory !== 'smm' && !loading && productCategories.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {language === 'pt' ? 'Categorias de Jogos' : language === 'en' ? 'Game Categories' : 'Categorías de Juegos'}
            </h2>
          </div>
          <div className="relative">
            {productCategories.length > 6 && (
              <>
                <button
                  onClick={() => scrollCategories('left')}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-lg rounded-full p-1.5 hover:scale-110 transition-transform"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </button>
                <button
                  onClick={() => scrollCategories('right')}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-lg rounded-full p-1.5 hover:scale-110 transition-transform"
                >
                  <ChevronRight className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </button>
              </>
            )}
            <div ref={categoriesScrollRef} className="flex gap-3 overflow-x-auto scroll-smooth scrollbar-hide pb-2">
              {productCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { window.history.pushState(null, '', `/category/${cat.slug}`); window.dispatchEvent(new PopStateEvent('popstate')); }}
                  className="group relative flex-shrink-0 w-[100px] sm:w-[120px] aspect-[3/5] rounded-xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 shadow-sm hover:shadow-lg hover:scale-[1.03] transition-all duration-200"
                >
                  {cat.image_url ? (
                    <img src={cat.image_url} alt={cat.name} className="absolute inset-0 w-full h-full object-cover transition-opacity" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Gamepad2 className="h-10 w-10 text-gray-500" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <p className="text-white text-xs sm:text-sm font-semibold leading-tight line-clamp-2 text-center">{cat.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recommended Products */}
      {!isFiltering && activeCategory !== 'smm' && !loading && products.length > 0 && (
        <div className="mb-8">
          <ProductRow
            title={t.language === 'pt' ? 'Recomendados para Você' : t.language === 'en' ? 'Recommended for You' : 'Recomendados para Ti'}
            subtitle={t.language === 'pt' ? 'Produtos selecionados aleatoriamente' : t.language === 'en' ? 'Randomly selected products' : 'Productos seleccionados al azar'}
            products={recommendedProducts}
            onProductClick={handleProductClick}
            icon={<Shuffle className="w-5 h-5 text-blue-500" />}
            onViewAll={() => { setActiveCategory('all'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
          {bestSellers.length > 0 && (
            <ProductRow
              title={t.language === 'pt' ? 'Mais Vendidos' : t.language === 'en' ? 'Best Sellers' : 'Más Vendidos'}
              subtitle={t.language === 'pt' ? 'Os produtos mais populares' : t.language === 'en' ? 'Most popular products' : 'Los productos más populares'}
              products={bestSellers}
              onProductClick={handleProductClick}
              icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
              onViewAll={() => { setActiveCategory('all'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            />
          )}
          {productsByCategory.map(({ category, products: catProducts }) => (
            <ProductRow
              key={category}
              title={category.charAt(0).toUpperCase() + category.slice(1)}
              products={catProducts}
              onProductClick={handleProductClick}
              icon={<FolderTree className="w-5 h-5 text-amber-500" />}
              onViewAll={() => { setActiveCategory(category); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            />
          ))}
          {recentlyViewedProducts.length > 0 && (
            <ProductRow
              title={t.language === 'pt' ? 'Vistos Recentemente' : t.language === 'en' ? 'Recently Viewed' : 'Vistos Recientemente'}
              products={recentlyViewedProducts}
              onProductClick={handleProductClick}
              icon={<Eye className="w-5 h-5 text-purple-500" />}
            />
          )}
        </div>
      )}

      {/* Products grid */}
      <div className={(!isFiltering && activeCategory !== 'smm' && !loading && products.length > 0) ? 'hidden' : ''}>

      {/* SMM Panel - shown when Social Media category is active */}
      {activeCategory === 'smm' ? (
        <div className="col-span-full">
          <SMMPanel onNavigate={onNavigate} />
        </div>
      ) : (
      <>
      {/* Products Grid */}
      <div className="products-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 lg:gap-6 min-w-0">
        {currentProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            userCredit={userCredit}
            onPurchase={handlePurchase}
            onCardClick={() => {
              window.history.pushState(null, '', `/product/${product.id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            purchasing={purchasing}
            onViewSellerProfile={(sellerId, sellerSlug) => {
              if (sellerSlug) {
                window.history.pushState(null, '', `/seller/${sellerSlug}`);
                window.dispatchEvent(new PopStateEvent('popstate'));
              } else {
                setSelectedSellerId(sellerId);
                setShowSellerProfile(true);
              }
            }}
            currentUserId={user?.id}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t.language === 'pt' ? 'Página' : t.language === 'en' ? 'Page' : 'Página'} {currentPage} {t.language === 'pt' ? 'de' : t.language === 'en' ? 'of' : 'de'} {totalPages}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-500">
              ({startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} {t.language === 'pt' ? 'de' : t.language === 'en' ? 'of' : 'de'} {filteredProducts.length})
            </span>
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 sm:p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            {/* Page numbers */}
            <div className="flex items-center space-x-0.5 sm:space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-2.5 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 sm:p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {filteredProducts.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          {searchTerm || activeCategory !== 'all' ? (
            <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
          ) : (
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          )}
          <p>
            {searchTerm || activeCategory !== 'all' ? 
              (t.language === 'pt' ? 'Nenhum produto encontrado para sua busca' : 
               t.language === 'en' ? 'No products found for your search' : 
               'No se encontraron productos para tu busqueda') :
              (t.language === 'pt' ? 'Nenhum produto disponivel no momento' : 
               t.language === 'en' ? 'No products available at the moment' : 
               'No hay productos disponibles en este momento')
            }
          </p>
        </div>
      )}
      </>
      )}
      </div>

      {/* Product Details Modal */}
      {showProductModal && selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          userCredit={userCredit}
          onClose={() => {
            setShowProductModal(false);
            setSelectedProduct(null);
          }}
          onPurchase={handlePurchase}
          purchasing={purchasing}
          onViewSellerProfile={(sellerId) => {
            setSelectedSellerId(sellerId);
            setShowSellerProfile(true);
            setShowProductModal(false);
          }}
          currentUserId={user?.id}
        />
      )}

      {/* Payment Modals */}
      <StripePaymentModal
        isOpen={showPaymentModal && selectedPaymentMethod === 'stripe'}
        onClose={() => setShowPaymentModal(false)}
        amount={purchaseAmount}
        onSuccess={handlePaymentSuccess}
      />

      <PayPalPaymentModal
        isOpen={showPaymentModal && selectedPaymentMethod === 'paypal'}
        onClose={() => setShowPaymentModal(false)}
        amount={purchaseAmount}
        onSuccess={handlePaymentSuccess}
      />

      <MercadoPagoPaymentModal
        isOpen={showPaymentModal && selectedPaymentMethod === 'mercadopago'}
        onClose={() => setShowPaymentModal(false)}
        amount={purchaseAmount}
        onSuccess={handlePaymentSuccess}
      />

      <WhatsAppPaymentModal
        isOpen={showPaymentModal && selectedPaymentMethod === 'whatsapp'}
        onClose={() => setShowPaymentModal(false)}
        amount={purchaseAmount}
        onSuccess={handlePaymentSuccess}
      />

      <CryptomusPaymentModal
        isOpen={showPaymentModal && selectedPaymentMethod === 'cryptomus'}
        onClose={() => setShowPaymentModal(false)}
        amount={purchaseAmount}
        onSuccess={handlePaymentSuccess}
      />

      <BinancePaymentModal
        isOpen={showPaymentModal && selectedPaymentMethod === 'binance'}
        onClose={() => setShowPaymentModal(false)}
        amount={purchaseAmount}
        onSuccess={handlePaymentSuccess}
      />

      {/* Recharge Modal */}
      {showRechargeModal && (
        <RechargeModal
          onClose={() => setShowRechargeModal(false)}
          paymentMethods={paymentMethods}
          onPaymentMethodSelect={handlePaymentMethodSelect}
        />
      )}

      {/* Purchase Success Modal */}
      {showSuccessModal && purchaseSuccessData && (
        <PurchaseSuccessModal
          isOpen={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false);
            setPurchaseSuccessData(null);
          }}
          productName={purchaseSuccessData.productName}
          price={purchaseSuccessData.price}
          orderId={purchaseSuccessData.orderId}
          onViewPurchase={() => {
            window.history.pushState(null, '', '/purchases');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
        />
      )}

      {/* Seller Profile Modal */}
      {showSellerProfile && (
        <PublicSellerProfile
          sellerId={selectedSellerId}
          onClose={() => {
            setShowSellerProfile(false);
            setSelectedSellerId(null);
          }}
          onProductClick={(product) => {
            window.history.pushState(null, '', `/product/${product.id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
            setShowSellerProfile(false);
          }}
        />
      )}

      {/* Purchase Confirmation Modal */}
      {productToConfirm && (
        <PurchaseConfirmModal
          isOpen={showConfirmModal}
          product={productToConfirm}
          userBalance={userCredit?.balance || 0}
          cashbackBalance={cashbackBalance}
          onConfirm={handleConfirmPurchase}
          onCancel={() => {
            setShowConfirmModal(false);
            setProductToConfirm(null);
            setSelectedVariation(null);
          }}
          isLoading={purchasing}
          variationId={selectedVariation?.id || null}
          variationName={selectedVariation?.name || null}
          variationPrice={selectedVariation ? Number(selectedVariation.price_usdt) : null}
        />
      )}

      {/* Rating Enforcement Modal */}
      {showRatingModal && pendingRating && (
        <ProductRatingModal
          isOpen={showRatingModal}
          onClose={() => {
            setShowRatingModal(false);
            setPendingRating(null);
          }}
          productId={pendingRating.productId}
          productName={pendingRating.productName}
          onRatingSubmitted={() => {
            setShowRatingModal(false);
            setPendingRating(null);
          }}
          force={true}
        />
      )}

      {/* Seller Request Form */}
      {showSellerForm && (
        <SellerRequestForm
          onClose={() => setShowSellerForm(false)}
          onSuccess={() => setShowSellerForm(false)}
        />
      )}

      {/* Login Modal for non-authenticated users trying to purchase */}
      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={() => setShowLoginModal(false)}
        />
      )}
    </div>
  );
}

interface PurchaseSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  price: number;
  orderId: string;
  onViewPurchase?: () => void;
}

function PurchaseSuccessModal({ isOpen, onClose, productName, price, orderId, onViewPurchase }: PurchaseSuccessModalProps) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t.language === 'pt' ? 'Compra Realizada!' : t.language === 'en' ? 'Purchase Completed!' : '¡Compra Realizada!'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Success Icon and Message */}
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-gray-700 dark:text-gray-300 text-lg">
              {t.language === 'pt'
                ? 'Sua compra foi realizada com sucesso!'
                : t.language === 'en'
                ? 'Your purchase was completed successfully!'
                : '¡Su compra se realizó con éxito!'}
            </p>
          </div>

          {/* Purchase Details */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t.language === 'pt' ? 'Produto:' : t.language === 'en' ? 'Product:' : 'Producto:'}
              </span>
              <span className="font-medium text-gray-900 dark:text-white text-right">{productName}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-600">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t.language === 'pt' ? 'Valor Pago:' : t.language === 'en' ? 'Amount Paid:' : 'Valor Pagado:'}
              </span>
              <span className="font-bold text-green-600 dark:text-green-400 text-lg">{formatPrice(price)}</span>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-300">
                {t.language === 'pt'
                  ? 'Acesse a aba "Minhas Compras" para visualizar suas credenciais e instruções de uso.'
                  : t.language === 'en'
                  ? 'Go to the "My Purchases" tab to view your credentials and usage instructions.'
                  : 'Accede a la pestaña "Mis Compras" para ver tus credenciales e instrucciones de uso.'}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <Check className="w-4 h-4" />
            {t.language === 'pt' ? 'Entendido' : t.language === 'en' ? 'Got it' : 'Entendido'}
          </button>
          {onViewPurchase && (
            <button
              onClick={() => {
                onViewPurchase();
                onClose();
              }}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Eye className="w-4 h-4" />
              {t.language === 'pt' ? 'Ver Compra' : t.language === 'en' ? 'View Purchase' : 'Ver Compra'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProductCardProps {
  product: ProductWithSeller;
  userCredit: UserCredit | null;
  onPurchase: (product: ProductWithSeller) => void;
  onCardClick: (product: ProductWithSeller) => void;
  purchasing: boolean;
  onViewSellerProfile: (sellerId: string | null, sellerSlug?: string) => void;
  currentUserId?: string;
}

function ProductCard({ product, userCredit, onPurchase, onCardClick, purchasing, onViewSellerProfile, currentUserId }: ProductCardProps) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const isOwnProduct = !!(currentUserId && product.seller_id && currentUserId === product.seller_id);
  const isAvailable = product.manual_delivery || (product as any).account_recharge || product.stock_quantity > 0;
  const canAfford = userCredit ? userCredit.balance >= Number(product.price_usdt) : false;
  const hasPromo = product.promotion_active && product.promotional_price_usdt;
  const discountPct = hasPromo
    ? Math.round((1 - Number(product.promotional_price_usdt) / Number(product.price_usdt)) * 100)
    : 0;
  const salesCount = (product as any).seller_info?.sales_count || 0;
  const lowStock = !product.manual_delivery && !(product as any).account_recharge && product.stock_quantity > 0 && product.stock_quantity <= 5;

  return (
    <div
      onClick={() => onCardClick(product)}
      className={`group relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer border border-gray-200 dark:border-gray-700 hover:-translate-y-1 min-w-0 ${
      !isAvailable ? 'opacity-75' : ''
      }`}
    >
      {/* Product Image */}
      <div className="relative aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden">
        {/* Top-left category badge */}
        <span className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-10 px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold bg-black/55 backdrop-blur-sm text-white capitalize">
          {product.category}
        </span>
        {/* Top-right promo / delivery */}
        <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10 flex flex-col items-end gap-1">
          {hasPromo && discountPct > 0 && (
            <span className="px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold bg-red-500 text-white shadow-sm">
              -{discountPct}%
            </span>
          )}
          {product.manual_delivery ? (
            (product as any).account_recharge ? (
              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-medium bg-amber-500 text-white shadow-sm">
                <Zap className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                {t.language === 'pt' ? 'Recarga' : t.language === 'en' ? 'Recharge' : 'Recarga'}
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-medium bg-blue-500 text-white shadow-sm">
                <Truck className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                {t.language === 'pt' ? 'Manual' : t.language === 'en' ? 'Manual' : 'Manual'}
              </span>
            )
          ) : (
            <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-medium bg-emerald-500 text-white shadow-sm">
              <Zap className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
              {t.language === 'pt' ? 'Auto' : t.language === 'en' ? 'Auto' : 'Auto'}
            </span>
          )}
        </div>

        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${
              !isAvailable ? 'grayscale opacity-60' : ''
            }`}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.opacity = '0';
            }}
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
              {t.language === 'pt' ? 'Esgotado' : t.language === 'en' ? 'Sold Out' : 'Agotado'}
            </span>
          </div>
        )}

        {/* Bottom badges: low stock + sales count */}
        <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 flex flex-col gap-1 z-10">
          {lowStock && (
            <span className="px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold bg-orange-500/90 backdrop-blur-sm text-white">
              {t.language === 'pt' ? `Restam ${product.stock_quantity}` : t.language === 'en' ? `${product.stock_quantity} left` : `Quedan ${product.stock_quantity}`}
            </span>
          )}
          {salesCount > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold bg-emerald-500/90 backdrop-blur-sm text-white">
              <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              {salesCount} {t.language === 'pt' ? 'vendidos' : t.language === 'en' ? 'sold' : 'vendidos'}
            </span>
          )}
        </div>
      </div>

      {/* Product Info */}
      <div className="p-2.5 sm:p-3 lg:p-4">
        <h3 className="font-bold text-xs sm:text-sm lg:text-base text-gray-900 dark:text-white mb-1 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {product.name}
        </h3>

        {product.seller_info && (
          <div className="mb-2 flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewSellerProfile(product.seller_id || null, product.seller_info?.seller_slug);
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium truncate max-w-[140px]"
            >
              {product.seller_info.business_name}
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
              · {product.seller_info.sales_count} {t.language === 'pt' ? 'vendas' : t.language === 'en' ? 'sales' : 'ventas'}
            </span>
          </div>
        )}

        {/* Product Rating */}
        <div className="mb-3">
          <ProductRatingsDisplay productId={product.id} showTitle={false} compact={true} />
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

        {/* Actions */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPurchase(product);
          }}
          disabled={isOwnProduct || !isAvailable || purchasing}
          className={`w-full px-2 sm:px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold ${
            !isOwnProduct && isAvailable && !purchasing
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          }`}
        >
          {purchasing ? (
            <Loader className="h-4 w-4 animate-spin" />
          ) : (
            <ShoppingCart className="h-4 w-4" />
          )}
          <span>
            {isOwnProduct ?
              (t.language === 'pt' ? 'Seu Produto' : t.language === 'en' ? 'Your Product' : 'Tu Producto') :
              !isAvailable ?
              (t.language === 'pt' ? 'Esgotado' : t.language === 'en' ? 'Sold Out' : 'Agotado') :
              (t.language === 'pt' ? 'Comprar' : t.language === 'en' ? 'Buy' : 'Comprar')
            }
          </span>
        </button>
      </div>
    </div>
  );
}

interface ProductDetailsModalProps {
  product: ProductWithSeller;
  userCredit: UserCredit | null;
  onClose: () => void;
  onPurchase: (product: ProductWithSeller) => void;
  purchasing: boolean;
  onViewSellerProfile: (sellerId: string | null, sellerSlug?: string) => void;
  currentUserId?: string;
}

interface RechargeModalProps {
  onClose: () => void;
  paymentMethods: PaymentMethod[];
  onPaymentMethodSelect: (methodId: string, amount: number) => void;
}

function RechargeModal({ onClose, paymentMethods, onPaymentMethodSelect }: RechargeModalProps) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState<string>('');

  const quickAmounts = [5, 10, 20, 50, 100, 200];

  function handleRecharge(methodId: string) {
    const amount = customAmount ? parseFloat(customAmount) : selectedAmount;
    if (amount <= 0) {
      alert(t.language === 'pt' ? 'Digite um valor válido' : t.language === 'en' ? 'Enter a valid amount' : 'Ingrese un monto válido');
      return;
    }
    onPaymentMethodSelect(methodId, amount);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 sm:top-10 mx-auto p-4 sm:p-6 border w-full max-w-2xl shadow-lg rounded-xl bg-white dark:bg-gray-800 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="min-w-0">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {t.language === 'pt' ? 'Recarregar Créditos' : t.language === 'en' ? 'Recharge Credits' : 'Recargar Créditos'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t.language === 'pt' ? 'Escolha o valor e método de pagamento' : t.language === 'en' ? 'Choose amount and payment method' : 'Elija el monto y método de pago'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Quick Amount Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t.language === 'pt' ? 'Valores Rápidos' : t.language === 'en' ? 'Quick Amounts' : 'Montos Rápidos'}
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-3">
            {quickAmounts.map((amount) => (
              <button
                key={amount}
                onClick={() => {
                  setSelectedAmount(amount);
                  setCustomAmount('');
                }}
                className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                  selectedAmount === amount && !customAmount
                    ? 'bg-green-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {amount}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Amount */}
        <div className="mb-4 sm:mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t.language === 'pt' ? 'Ou digite um valor personalizado' : t.language === 'en' ? 'Or enter custom amount' : 'O ingrese un monto personalizado'}
          </label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="number"
              min="1"
              step="0.01"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedAmount(0);
              }}
              placeholder="0.00"
              className="pl-10 pr-4 py-3 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg font-semibold"
            />
          </div>
        </div>

        {/* Payment Methods */}
        <div className="mb-4 sm:mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t.language === 'pt' ? 'Método de Pagamento' : t.language === 'en' ? 'Payment Method' : 'Método de Pago'}
          </label>
          <div className="space-y-2">
            {paymentMethods.filter(m => m.enabled).map((method) => (
              <button
                key={method.id}
                onClick={() => handleRecharge(method.id)}
                className="w-full p-3 sm:p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center p-1 flex-shrink-0">
                      <img src={method.icon} alt={method.name} className="w-full h-full object-contain rounded-md" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 text-sm sm:text-base truncate">
                        {method.name}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {method.description}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductDetailsModal({ product, userCredit, onClose, onPurchase, purchasing, onViewSellerProfile, currentUserId }: ProductDetailsModalProps) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const isOwnProduct = !!(currentUserId && product.seller_id && currentUserId === product.seller_id);
  const canAfford = userCredit ? userCredit.balance >= Number(product.price_usdt) : false;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 sm:top-10 mx-auto p-4 sm:p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
            {t.language === 'pt' ? 'Detalhes do Produto' : t.language === 'en' ? 'Product Details' : 'Detalles del Producto'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        <div className="space-y-4 sm:space-y-6">
          {/* Product Image */}
          <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`flex items-center justify-center w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 ${product.image_url ? 'hidden' : ''}`}>
              <Package className="h-16 w-16 text-white" />
            </div>
          </div>

          {/* Product Info */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
              <div className="min-w-0 flex-1">
                <h4 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight">{product.name}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                  {product.category}
                </p>
                {product.renewable && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 mt-2">
                    🔄 {t.language === 'pt' ? 'Renovável' :
                        t.language === 'en' ? 'Renewable' :
                        'Renovable'}
                  </span>
                )}
              </div>
              <div className="text-left sm:text-right flex-shrink-0">
                <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
                  {formatPrice(Number(product.price_usdt))}
                </div>
              </div>
            </div>

            {product.description && (
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t.language === 'pt' ? 'Descrição' : t.language === 'en' ? 'Description' : 'Descripción'}
                </h5>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}

            {/* Features */}
            {product.features && product.features.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t.language === 'pt' ? 'Características' : t.language === 'en' ? 'Features' : 'Características'}
                </h5>
                <div className="flex flex-wrap gap-2">
                  {product.features.map((feature, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Product Ratings */}
            <div className="mb-4">
              <ProductRatingsDisplay productId={product.id} showTitle={true} compact={false} />
            </div>

            {/* Seller Info */}
            {product.seller_info && (
              <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <h5 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-2">
                  {t.language === 'pt' ? 'Informações do Vendedor' : t.language === 'en' ? 'Seller Information' : 'Información del Vendedor'}
                </h5>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">
                        {product.seller_info.business_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewSellerProfile(product.seller_id || null, product.seller_info?.seller_slug);
                        }}
                        className="font-medium text-purple-900 dark:text-purple-200 hover:underline text-left"
                      >
                        {product.seller_info.business_name}
                      </button>
                      <p className="text-sm text-purple-700 dark:text-purple-400">
                        {t.language === 'pt' ? 'Vendedor Verificado' : t.language === 'en' ? 'Verified Seller' : 'Vendedor Verificado'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewSellerProfile(product.seller_id || null, product.seller_info?.seller_slug);
                    }}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    {t.language === 'pt' ? 'Ver Perfil' : t.language === 'en' ? 'View Profile' : 'Ver Perfil'}
                  </button>
                </div>
              </div>
            )}


            {/* Stock Information */}
            {!product.manual_delivery && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700 dark:text-blue-400">
                    {t.language === 'pt' ? 'Disponibilidade em Estoque:' : t.language === 'en' ? 'Stock Availability:' : 'Disponibilidad en Inventario:'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-lg ${
                      product.stock_quantity > 5
                        ? 'text-green-600 dark:text-green-400'
                        : product.stock_quantity > 0
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {product.stock_quantity}
                    </span>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                      product.stock_quantity > 5
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : product.stock_quantity > 0
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      {product.stock_quantity > 5
                        ? (t.language === 'pt' ? 'Em Estoque' : t.language === 'en' ? 'In Stock' : 'En Stock')
                        : product.stock_quantity > 0
                        ? (t.language === 'pt' ? 'Estoque Limitado' : t.language === 'en' ? 'Limited Stock' : 'Stock Limitado')
                        : (t.language === 'pt' ? 'Fora de Estoque' : t.language === 'en' ? 'Out of Stock' : 'Agotado')}
                    </span>
                  </div>
                </div>
                {product.stock_quantity <= 5 && product.stock_quantity > 0 && (
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-2">
                    {t.language === 'pt' ? 'Apenas alguns itens disponíveis. Não perca!' :
                     t.language === 'en' ? 'Only a few items left. Don\'t miss out!' :
                     'Solo quedan pocos artículos. ¡No te lo pierdas!'}
                  </p>
                )}
              </div>
            )}

            {/* Balance Check */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700 dark:text-blue-400">
                  {t.language === 'pt' ? 'Seu saldo atual:' : t.language === 'en' ? 'Your current balance:' : 'Tu saldo actual:'}
                </span>
                <span className="font-bold text-blue-900 dark:text-blue-200">
                  {formatPrice(userCredit?.balance || 0)}
                </span>
              </div>
              {(!canAfford && product.stock_quantity > 0 && !product.manual_delivery) && (
                <div className="mt-2 flex items-center text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  <span className="text-xs">
                    {t.language === 'pt' ? 'Saldo insuficiente para esta compra' :
                     t.language === 'en' ? 'Insufficient balance for this purchase' :
                     'Saldo insuficiente para esta compra'}
                  </span>
                </div>
              )}
            </div>

            {/* Renewable Tag */}
            {product.renewable && (
              <div className="mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                  {t.language === 'pt' ? 'Produto Renovável' :
                   t.language === 'en' ? 'Renewable Product' :
                   'Producto Renovable'}
                </span>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                  {t.language === 'pt' ? 'Este produto pode ser renovado após expiração' :
                   t.language === 'en' ? 'This product can be renewed after expiration' :
                   'Este producto puede renovarse después de la expiración'}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              {t.language === 'pt' ? 'Fechar' : t.language === 'en' ? 'Close' : 'Cerrar'}
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPurchase(product);
              }}
              disabled={isOwnProduct || (!product.manual_delivery && product.stock_quantity === 0) || purchasing}
              className={`flex-1 px-4 py-2.5 sm:py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium ${
                !isOwnProduct && (product.manual_delivery || product.stock_quantity > 0) && !purchasing
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              {purchasing ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="h-4 w-4" />
              )}
              <span>
                {isOwnProduct ?
                  (t.language === 'pt' ? 'Seu Produto' : t.language === 'en' ? 'Your Product' : 'Tu Producto') :
                  (!product.manual_delivery && product.stock_quantity === 0) ?
                  (t.language === 'pt' ? 'Fora de Estoque' : t.language === 'en' ? 'Out of Stock' : 'Agotado') :
                  (t.language === 'pt' ? 'Comprar Agora' : t.language === 'en' ? 'Buy Now' : 'Comprar Ahora')
                }
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
