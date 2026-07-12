import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Package, Star, DollarSign, Search, Check, AlertCircle, CreditCard, Loader, X, Truck, ArrowRight, ChevronLeft, ChevronRight, Eye, Image as ImageIcon, Store as StoreIcon, LayoutGrid, Clapperboard, Code, KeyRound, Music, Gamepad2, Shield, Gift, BookOpen, UserCheck, MessageCircle, Zap, TrendingUp, type LucideIcon } from 'lucide-react';
import { supabase, StoreProduct } from '../lib/supabase';
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

interface UserCredit {
  balance: number;
  total_recharged: number;
  total_spent: number;
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
  };
}

interface StoreProps {
  onNavigate?: (tab: string) => void;
}

export function Store({ onNavigate }: StoreProps = {}) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { addNotification } = useNotificationContext();
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<ProductWithSeller[]>([]);
  const [userCredit, setUserCredit] = useState<UserCredit | null>(null);
  const [cashbackBalance, setCashbackBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<ProductWithSeller | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [purchaseAmount, setPurchaseAmount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 12;
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [purchaseSuccessData, setPurchaseSuccessData] = useState<{productName: string; price: number; orderId: string} | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [showSellerProfile, setShowSellerProfile] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [productToConfirm, setProductToConfirm] = useState<ProductWithSeller | null>(null);
  const [banners, setBanners] = useState<any[]>([]);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [pendingRating, setPendingRating] = useState<{ productId: string; productName: string } | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showSellerForm, setShowSellerForm] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [hasRequestedSeller, setHasRequestedSeller] = useState(false);

  useEffect(() => {
    if (user) {
      loadStoreData();
      loadUserCredit();
      loadUserProfile();
    }
    loadBanners();
  }, [user]);

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

      // Fetch admin profile and both sales counts once (not per product)
      const [{ data: adminProfile }, { data: adminSalesCount }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, seller_slug').eq('role', 'admin').maybeSingle(),
        supabase.rpc('get_admin_sales_count'),
      ]);

      // Cache seller counts to avoid duplicate RPC calls for the same seller
      const sellerCountCache: Record<string, number> = {};

      const productsWithSellers = await Promise.all(
        (data || []).map(async (product) => {
          if (product.seller_id) {
            if (sellerCountCache[product.seller_id] === undefined) {
              const { data: sellerData } = await supabase
                .from('profiles')
                .select('full_name, seller_slug')
                .eq('id', product.seller_id)
                .maybeSingle();
              const { data: cnt } = await supabase.rpc('get_seller_sales_count', { seller_uuid: product.seller_id });
              sellerCountCache[product.seller_id] = Number(cnt) || 0;
              return {
                ...product,
                seller_info: {
                  business_name: sellerData?.full_name || 'Unknown Seller',
                  sales_count: sellerCountCache[product.seller_id],
                  seller_slug: sellerData?.seller_slug,
                }
              };
            }
            const { data: sellerData } = await supabase
              .from('profiles')
              .select('full_name, seller_slug')
              .eq('id', product.seller_id)
              .maybeSingle();
            return {
              ...product,
              seller_info: {
                business_name: sellerData?.full_name || 'Unknown Seller',
                sales_count: sellerCountCache[product.seller_id],
                seller_slug: sellerData?.seller_slug,
              }
            };
          }

          return {
            ...product,
            seller_id: adminProfile?.id ?? null,
            seller_info: {
              business_name: adminProfile?.full_name || 'Admin',
              sales_count: Number(adminSalesCount) || 0,
              seller_slug: adminProfile?.seller_slug,
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
        .select('balance, total_recharged, total_spent')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setUserCredit(data || { balance: 0, total_recharged: 0, total_spent: 0 });

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
      setUserCredit({ balance: 0, total_recharged: 0, total_spent: 0 });
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
        .select('id, product_id')
        .eq('user_id', user.id)
        .in('status', ['delivered', 'paid'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (error || !orders || orders.length === 0) return false;

      const lastOrder = orders[0];
      if (!lastOrder.product_id) return false;

      const { data: rating } = await supabase
        .from('product_ratings')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', lastOrder.product_id)
        .maybeSingle();

      if (!rating) {
        const { data: prod } = await supabase
          .from('store_products')
          .select('name')
          .eq('id', lastOrder.product_id)
          .single();
        setPendingRating({ productId: lastOrder.product_id, productName: prod?.name || 'Produto' });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  function handlePurchase(product: ProductWithSeller) {
    if (!user || !userCredit) return;

    checkPendingRatings().then(hasPending => {
      if (hasPending) {
        setShowRatingModal(true);
        return;
      }

      const price = product.price_usdt;

      if (userCredit.balance < price) {
        alert(t.language === 'pt' ?
          `Saldo insuficiente. Você precisa de ${formatPrice(price)} mas tem apenas ${formatPrice(userCredit.balance)}. Recarregue sua conta primeiro.` :
          t.language === 'en' ?
          `Insufficient balance. You need ${formatPrice(price)} but only have ${formatPrice(userCredit.balance)}. Please recharge your account first.` :
          `Saldo insuficiente. Necesitas ${formatPrice(price)} pero solo tienes ${formatPrice(userCredit.balance)}. Recarga tu cuenta primero.`
        );
        return;
      }

      setProductToConfirm(product);
      setShowConfirmModal(true);
    });
  }

  async function handleConfirmPurchase(couponCode?: string, rechargeData?: { email: string; password: string; extra_data: string }, useCashback?: boolean, quantity?: number) {
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
          use_cashback: useCashback || false
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao processar compra');
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
    return matchesSearch && matchesCategory;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  const startIndex = (currentPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeCategory]);


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
      {/* Header - Store Name and Balance */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{t.store}</h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t.language === 'pt' ? 'Compre produtos premium com seus créditos' :
             t.language === 'en' ? 'Buy premium products with your credits' :
             'Compra productos premium con tus créditos'}
          </p>
        </div>
        <div className="flex flex-row sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
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
          <button
            onClick={() => onNavigate?.('credits')}
            className="flex-1 sm:flex-initial bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 px-3 sm:px-6 py-2.5 sm:py-3 group"
          >
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="bg-white/20 rounded-lg p-1.5 sm:p-2">
              <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="text-left">
              <div className="text-[10px] sm:text-xs font-medium opacity-90">
                {t.language === 'pt' ? 'Saldo Disponível' : t.language === 'en' ? 'Available Balance' : 'Saldo Disponible'}
              </div>
              <div className="text-lg sm:text-2xl font-bold">
                {formatPrice(userCredit?.balance || 0)}
              </div>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
              <ArrowRight className="h-5 w-5" />
            </div>
          </div>
        </button>
        </div>
      </div>

      {/* Rotating Banner Carousel */}
      {banners.length > 0 && (
        <div className="relative rounded-xl overflow-hidden shadow-lg group h-32 sm:h-44 lg:h-56">
          {banners.map((banner, idx) => (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-all duration-700 ${idx === currentBanner ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'}`}
            >
              <div className="absolute inset-0" style={{ backgroundColor: banner.bg_color }} />
              {banner.image_url && (
                <img
                  src={banner.image_url}
                  alt={banner.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-40"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div
                className={`relative h-full flex flex-col justify-center px-4 sm:px-8 lg:px-12 ${
                  banner.text_position === 'center' ? 'items-center text-center' :
                  banner.text_position === 'right' ? 'items-end text-right' :
                  'items-start text-left'
                }`}
                style={{ color: banner.text_color }}
              >
                <h2 className="text-base sm:text-xl lg:text-2xl font-bold mb-1 drop-shadow-lg line-clamp-2">{banner.title}</h2>
                {banner.subtitle && (
                  <p className="text-xs sm:text-sm lg:text-base opacity-90 mb-2 max-w-md drop-shadow-md line-clamp-2">{banner.subtitle}</p>
                )}
                {banner.link_url && (
                  <a
                    href={banner.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 transition-all hover:scale-105"
                  >
                    {banner.link_text || (t.language === 'pt' ? 'Ver mais' : t.language === 'en' ? 'See more' : 'Ver más')}
                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
          {banners.length > 1 && (
            <>
              <button
                onClick={() => setCurrentBanner(prev => (prev - 1 + banners.length) % banners.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentBanner(prev => (prev + 1) % banners.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {banners.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentBanner(idx)}
                    className={`h-1.5 rounded-full transition-all ${idx === currentBanner ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-3 sm:mb-4">
        <div className="relative">
          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder={
              t.language === 'pt' ? 'Buscar produtos...' :
              t.language === 'en' ? 'Search products...' :
              'Buscar productos...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all text-sm"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="mb-4 sm:mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-2 sm:p-3 min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide min-w-0" style={{ scrollbarWidth: 'none' }}>
          {categories.map(({ key, label, icon: Icon, color, count }) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                activeCategory === key
                  ? color.activeBg + ' ' + color.activeText + ' shadow-md scale-105'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:scale-105'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{label}</span>
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeCategory === key
                    ? color.badgeActive
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

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
            onCardClick={(product) => {
              window.location.hash = `product/${product.id}`;
            }}
            purchasing={purchasing}
            onViewSellerProfile={(sellerId, sellerSlug) => {
              if (sellerSlug) {
                window.location.hash = `seller/${sellerSlug}`;
              } else {
                setSelectedSellerId(sellerId);
                setShowSellerProfile(true);
              }
            }}
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
            window.location.hash = '#purchases';
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
            window.location.hash = `product/${product.id}`;
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
          }}
          isLoading={purchasing}
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
}

function ProductCard({ product, userCredit, onPurchase, onCardClick, purchasing, onViewSellerProfile }: ProductCardProps) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const canAfford = userCredit ? userCredit.balance >= product.price_usdt : false;
  const isAvailable = product.manual_delivery || (product as any).account_recharge || product.stock_quantity > 0;

  return (
    <div
      onClick={() => onCardClick(product)}
      className={`group relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 cursor-pointer border border-gray-200 dark:border-gray-700 hover:-translate-y-1 min-w-0 ${
      !isAvailable ? 'opacity-75' : ''
      }`}
    >
      {/* Product Image */}
      <div className="relative aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden">
        {/* Delivery Tag */}
        {product.manual_delivery ? (
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10">
            <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-blue-500 text-white shadow-sm">
              <Truck className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
              {t.language === 'pt' ? 'Entrega Manual' :
               t.language === 'en' ? 'Manual Delivery' :
               'Entrega Manual'}
            </span>
          </div>
        ) : (product as any).account_recharge ? (
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10">
            <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-amber-500 text-white shadow-sm">
              <Zap className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
              {t.language === 'pt' ? 'Recarga' :
               t.language === 'en' ? 'Recharge' :
               'Recarga'}
            </span>
          </div>
        ) : product.auto_delivery && (
          <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10">
            <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-green-500 text-white shadow-sm">
              <Truck className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
              {t.language === 'pt' ? 'Entrega Automática' :
               t.language === 'en' ? 'Auto Delivery' :
               'Entrega Automática'}
            </span>
          </div>
        )}

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
          <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 ${!isAvailable ? 'grayscale opacity-60' : ''}`}>
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

        {/* Low Stock Badge */}
        {isAvailable && !product.manual_delivery && product.stock_quantity > 0 && product.stock_quantity <= 5 && (
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-xs font-medium bg-orange-500/80 backdrop-blur-sm text-white">
            {t.language === 'pt' ? `Restam ${product.stock_quantity}` : t.language === 'en' ? `${product.stock_quantity} left` : `Quedan ${product.stock_quantity}`}
          </span>
        )}
      </div>

      {/* Product Info */}
      <div className="p-2.5 sm:p-3 lg:p-4">
        {/* Delivery Tag - Mobile only */}
        {product.manual_delivery ? (
          <div className="mb-2 sm:hidden">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-500 text-white shadow-sm">
              <Truck className="h-3 w-3 mr-1" />
              {t.language === 'pt' ? 'Entrega Manual' :
               t.language === 'en' ? 'Manual Delivery' :
               'Entrega Manual'}
            </span>
          </div>
        ) : (product as any).account_recharge ? (
          <div className="mb-2 sm:hidden">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-500 text-white shadow-sm">
              <Zap className="h-3 w-3 mr-1" />
              {t.language === 'pt' ? 'Recarga' :
               t.language === 'en' ? 'Recharge' :
               'Recarga'}
            </span>
          </div>
        ) : product.auto_delivery && (
          <div className="mb-2 sm:hidden">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500 text-white shadow-sm">
              <Truck className="h-3 w-3 mr-1" />
              {t.language === 'pt' ? 'Entrega Automática' :
               t.language === 'en' ? 'Auto Delivery' :
               'Entrega Automática'}
            </span>
          </div>
        )}

        <h3 className="font-bold text-xs sm:text-sm lg:text-base text-gray-900 dark:text-white mb-1 line-clamp-1">
          {product.name}
        </h3>

        {product.seller_info && (
          <div className="mb-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewSellerProfile(product.seller_id || null, product.seller_info?.seller_slug);
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              {product.seller_info.business_name}
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
              ({product.seller_info.sales_count} {t.language === 'pt' ? 'vendas' : t.language === 'en' ? 'sales' : 'ventas'})
            </span>
          </div>
        )}

        {product.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
            {product.description}
          </p>
        )}

        {/* Features - Hidden on mobile */}
        {product.features && product.features.length > 0 && (
          <div className="hidden sm:flex flex-wrap gap-1 mb-2">
            {product.features.slice(0, 2).map((feature, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
              >
                {feature}
              </span>
            ))}
            {product.features.length > 2 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                +{product.features.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Product Rating */}
        <div className="mb-3">
          <ProductRatingsDisplay productId={product.id} showTitle={false} compact={true} />
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1.5 sm:gap-2 mb-2 sm:mb-3">
          <span className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 dark:text-white">
            {formatPrice(product.price_usdt)}
          </span>
        </div>

        {/* Actions */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPurchase(product);
          }}
          disabled={!canAfford || !isAvailable || purchasing}
          className={`w-full px-2 sm:px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold ${
            canAfford && isAvailable && !purchasing
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
            {!canAfford ?
              (t.language === 'pt' ? 'Saldo Insuf.' : t.language === 'en' ? 'Insufficient' : 'Insuficiente') :
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

function ProductDetailsModal({ product, userCredit, onClose, onPurchase, purchasing, onViewSellerProfile }: ProductDetailsModalProps) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const canAfford = userCredit ? userCredit.balance >= product.price_usdt : false;

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
                  {formatPrice(product.price_usdt)}
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
              {!canAfford && (
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
              disabled={!canAfford || (!product.manual_delivery && product.stock_quantity === 0) || purchasing}
              className={`flex-1 px-4 py-2.5 sm:py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium ${
                canAfford && (product.manual_delivery || product.stock_quantity > 0) && !purchasing
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
                {!canAfford ?
                  (t.language === 'pt' ? 'Saldo Insuficiente' : t.language === 'en' ? 'Insufficient Balance' : 'Saldo Insuficiente') :
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
