import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, ArrowRight, Package, Check, Truck, ShoppingCart, Star,
  AlertCircle, Loader, UserCheck, CreditCard,
  Share2, CheckCircle2, Zap, Clock, ChevronDown, Minus, Plus,
  ShieldCheck, Award, Store, Tag, Layers, Heart, ThumbsUp,
  MessageCircle, TrendingUp, BadgeCheck, Sparkles, Info, ChevronRight
} from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { useAuth } from './AuthProvider';
import { supabase, StoreProduct, ProductVariation } from '../lib/supabase';
import { fetchSingleSellerInfo, fetchAdminSellerInfo } from '../lib/sellerInfo';
import { LoginModal } from './LoginModal';
import { ProductRatingsDisplay } from './ProductRatingsDisplay';
import { PurchaseConfirmModal } from './PurchaseConfirmModal';
import { ProductRatingModal } from './ProductRatingModal';
import { SellerReputation } from './SellerReputation';
import { ProductQABlock } from './ProductQABlock';

interface ProductWithSeller extends StoreProduct {
  seller_info?: {
    business_name: string;
    sales_count: number;
    seller_slug?: string;
    avatar_url?: string | null;
    seller_level?: number;
    seller_id?: string | null;
  };
  is_seller_product?: boolean;
  seller_application_id?: string;
  slug?: string;
}

interface UserCredit {
  balance: number;
  total_recharged: number;
  total_spent: number;
}

interface ProductDetailPageProps {
  productId: string;
  onBack: () => void;
  onGetStarted: () => void;
  onNavigate?: (tab: string, opts?: { presetAmount?: number }) => void;
}

type TabKey = 'overview' | 'features' | 'ratings' | 'qa' | 'seller';

export function ProductDetailPage({ productId, onBack, onGetStarted, onNavigate }: ProductDetailPageProps) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const [storeConfig, setStoreConfig] = useState<{ store_name?: string; store_logo_url?: string; store_description?: string } | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<ProductWithSeller[]>([]);
  const [product, setProduct] = useState<ProductWithSeller | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userCredit, setUserCredit] = useState<UserCredit | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [pendingRating, setPendingRating] = useState<{ productId: string; productName: string; orderId: string } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [purchaseSuccessData, setPurchaseSuccessData] = useState<{ productName: string; price: number; orderId: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [variationStocks, setVariationStocks] = useState<Record<string, number>>({});
  const [showVariationDropdown, setShowVariationDropdown] = useState(false);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [stickyBarVisible, setStickyBarVisible] = useState(false);

  const lang = t.language;
  const tr = useMemo(() => ({
    back: lang === 'pt' ? 'Voltar à loja' : lang === 'en' ? 'Back to store' : 'Volver a la tienda',
    share: lang === 'pt' ? 'Compartilhar' : lang === 'en' ? 'Share' : 'Compartir',
    copied: lang === 'pt' ? 'Copiado!' : 'Copied!',
    soldOut: lang === 'pt' ? 'Esgotado' : lang === 'en' ? 'Sold Out' : 'Agotado',
    left: (n: number) => lang === 'pt' ? `Restam ${n}` : lang === 'en' ? `${n} left` : `Quedan ${n}`,
    recharge: lang === 'pt' ? 'Recarga' : lang === 'en' ? 'Recharge' : 'Recarga',
    manualDelivery: lang === 'pt' ? 'Entrega Manual' : lang === 'en' ? 'Manual Delivery' : 'Entrega Manual',
    renewable: lang === 'pt' ? 'Renovável' : lang === 'en' ? 'Renewable' : 'Renovable',
    description: lang === 'pt' ? 'Descrição' : lang === 'en' ? 'Description' : 'Descripción',
    estimatedDelivery: lang === 'pt' ? 'Tempo estimado de entrega' : lang === 'en' ? 'Estimated delivery time' : 'Tiempo estimado de entrega',
    chooseVariation: lang === 'pt' ? 'Escolha uma variação' : lang === 'en' ? 'Choose a variation' : 'Elige una variación',
    select: lang === 'pt' ? 'Selecione...' : lang === 'en' ? 'Select...' : 'Seleccionar...',
    features: lang === 'pt' ? 'Recursos' : lang === 'en' ? 'Features' : 'Características',
    availability: lang === 'pt' ? 'Disponibilidade' : lang === 'en' ? 'Availability' : 'Disponibilidad',
    inStock: (n: number) => lang === 'pt' ? `${n} em estoque` : lang === 'en' ? `${n} in stock` : `${n} en stock`,
    quantity: lang === 'pt' ? 'Quantidade:' : lang === 'en' ? 'Quantity:' : 'Cantidad:',
    buyNow: lang === 'pt' ? 'Comprar Agora' : lang === 'en' ? 'Buy Now' : 'Comprar Ahora',
    signInToBuy: lang === 'pt' ? 'Entrar para Comprar' : lang === 'en' ? 'Sign In to Buy' : 'Iniciar Sesión para Comprar',
    balance: (b: number) => lang === 'pt' ? `Saldo: ${formatPrice(b)}` : `Balance: ${formatPrice(b)}`,
    signInOrRegister: lang === 'pt' ? 'Entre ou cadastre-se para completar sua compra' : lang === 'en' ? 'Sign in or register to complete your purchase' : 'Inicia sesión o regístrate para completar tu compra',
    relatedProducts: lang === 'pt' ? 'Produtos Relacionados' : lang === 'en' ? 'Related Products' : 'Productos Relacionados',
    productNotFound: lang === 'pt' ? 'Produto não encontrado' : lang === 'en' ? 'Product not found' : 'Producto no encontrado',
    purchaseComplete: lang === 'pt' ? 'Compra Realizada!' : lang === 'en' ? 'Purchase Complete!' : 'Compra Completada!',
    youPurchased: (n: string) => lang === 'pt' ? `Você comprou ${n}` : lang === 'en' ? `You purchased ${n}` : `Compraste ${n}`,
    viewMyPurchases: lang === 'pt' ? 'Ver Minhas Compras' : lang === 'en' ? 'View My Purchases' : 'Ver Mis Compras',
    sales: lang === 'pt' ? 'vendas' : lang === 'en' ? 'sales' : 'ventas',
    overview: lang === 'pt' ? 'Visão Geral' : lang === 'en' ? 'Overview' : 'Resumen',
    ratings: lang === 'pt' ? 'Avaliações' : lang === 'en' ? 'Ratings' : 'Reseñas',
    qa: lang === 'pt' ? 'Perguntas & Respostas' : lang === 'en' ? 'Q & A' : 'Preguntas y Respuestas',
    sellerInfo: lang === 'pt' ? 'Vendedor' : lang === 'en' ? 'Seller' : 'Vendedor',
    guaranteed: lang === 'pt' ? 'Compra Garantida' : lang === 'en' ? 'Protected Purchase' : 'Compra Protegida',
    guaranteedDesc: lang === 'pt' ? 'Reembolso garantido em caso de problemas' : lang === 'en' ? 'Refund guaranteed in case of issues' : 'Reembolso garantizado en caso de problemas',
    securePay: lang === 'pt' ? 'Pagamento Seguro' : lang === 'en' ? 'Secure Payment' : 'Pago Seguro',
    instantDelivery: lang === 'pt' ? 'Entrega Instantânea' : lang === 'en' ? 'Instant Delivery' : 'Entrega Instantánea',
    instantDeliveryDesc: lang === 'pt' ? 'Receba seu produto em segundos' : lang === 'en' ? 'Receive your product in seconds' : 'Recibe tu producto en segundos',
    favorite: lang === 'pt' ? 'Favoritar' : lang === 'en' ? 'Favorite' : 'Favorito',
    favoriteAdded: lang === 'pt' ? 'Adicionado aos favoritos' : lang === 'en' ? 'Added to favorites' : 'Añadido a favoritos',
    total: lang === 'pt' ? 'Total' : lang === 'en' ? 'Total' : 'Total',
    freeShipping: lang === 'pt' ? 'Entrega Digital Grátis' : lang === 'en' ? 'Free Digital Delivery' : 'Entrega Digital Gratis',
    highlights: lang === 'pt' ? 'Destaques' : lang === 'en' ? 'Highlights' : 'Destacados',
    specifications: lang === 'pt' ? 'Especificações' : lang === 'en' ? 'Specifications' : 'Especificaciones',
    category: lang === 'pt' ? 'Categoria' : lang === 'en' ? 'Category' : 'Categoría',
    delivery: lang === 'pt' ? 'Entrega' : lang === 'en' ? 'Delivery' : 'Entrega',
    stock: lang === 'pt' ? 'Estoque' : lang === 'en' ? 'Stock' : 'Inventario',
    auto: lang === 'pt' ? 'Automática' : lang === 'en' ? 'Automatic' : 'Automática',
    manual: lang === 'pt' ? 'Manual' : lang === 'en' ? 'Manual' : 'Manual',
    yes: lang === 'pt' ? 'Sim' : lang === 'en' ? 'Yes' : 'Sí',
    no: lang === 'pt' ? 'Não' : lang === 'en' ? 'No' : 'No',
  }), [lang, formatPrice]);

  useEffect(() => {
    loadProduct();
    loadStoreConfig();
  }, [productId]);

  useEffect(() => {
    if (product) loadRelatedProducts();
  }, [product]);

  useEffect(() => { window.scrollTo(0, 0); }, [productId]);

  useEffect(() => {
    if (user) loadUserCredit();
  }, [user]);

  useEffect(() => {
    const onScroll = () => setStickyBarVisible(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  async function loadProduct() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('store_products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();
      if (error) throw error;
      if (!data) { setError('Product not found'); return; }

      const productData: ProductWithSeller = { ...data } as ProductWithSeller;
      const { data: productSalesCount } = await supabase.rpc('get_product_sales_count', { product_uuid: data.id });
      const salesCount = Number(productSalesCount) || 0;

      if (data.seller_id) {
        const sellerData = await fetchSingleSellerInfo(data.seller_id);
        const { data: levelInfo } = await supabase
          .rpc('get_seller_level_info', { p_seller_id: data.seller_id });
        productData.seller_info = {
          business_name: sellerData?.full_name || sellerData?.username || sellerData?.seller_slug || 'Vendedor',
          sales_count: salesCount,
          seller_slug: sellerData?.seller_slug ?? null,
          avatar_url: sellerData?.avatar_url || null,
          seller_level: (levelInfo as any)?.seller_level || 1,
          seller_id: data.seller_id,
        };
      } else {
        const adminProfile = await fetchAdminSellerInfo();
        productData.seller_info = {
          business_name: adminProfile?.full_name || 'Admin',
          sales_count: salesCount,
          seller_slug: adminProfile?.seller_slug ?? null,
          avatar_url: adminProfile?.avatar_url || null,
          seller_id: adminProfile?.id || null,
        };
      }
      setProduct(productData);

      const { data: variationData } = await supabase
        .from('store_product_variations')
        .select('*')
        .eq('product_id', data.id)
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (variationData && variationData.length > 0) {
        setVariations(variationData);
        setSelectedVariation(variationData[0]);
        const stocks: Record<string, number> = {};
        for (const v of variationData) {
          const { data: count } = await supabase.rpc('get_variation_stock_count', { p_variation_id: v.id });
          stocks[v.id] = count || 0;
        }
        setVariationStocks(stocks);
      } else {
        const { data: totalStock } = await supabase.rpc('get_product_total_stock', { p_product_id: data.id });
        if (totalStock !== null && totalStock !== undefined) {
          setProduct(prev => prev ? { ...prev, stock_quantity: totalStock } : prev);
        }
      }
    } catch (err) {
      console.error('Error loading product:', err);
      setError('Failed to load product');
    } finally {
      setLoading(false);
    }
  }

  async function loadUserCredit() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_credits')
        .select('balance, total_recharged, total_spent')
        .eq('user_id', user.id)
        .maybeSingle();
      setUserCredit(data);
    } catch { /* ignore */ }
  }

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
    if (!product) return;
    try {
      const { data, error } = await supabase
        .from('store_products')
        .select('*')
        .eq('active', true)
        .eq('category', product.category)
        .neq('id', product.id)
        .order('created_at', { ascending: false })
        .limit(4);
      if (!error && data) setRelatedProducts(data as ProductWithSeller[]);
    } catch { /* ignore */ }
  }

  async function checkPendingRatings(): Promise<boolean> {
    if (!user) return false;
    try {
      const { data } = await supabase
        .from('store_orders')
        .select('id, product_id, store_products!inner(name)')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1);
      if (!data || data.length === 0) return false;
      const lastOrder = data[0] as any;
      const { data: rating } = await supabase
        .from('product_ratings')
        .select('id')
        .eq('user_id', user.id)
        .eq('order_id', lastOrder.id)
        .limit(1);
      if (!rating || rating.length === 0) {
        setPendingRating({ productId: lastOrder.product_id, productName: lastOrder.store_products?.name || '', orderId: lastOrder.id });
        return true;
      }
      return false;
    } catch { return false; }
  }

  const hasPromo = product?.promotion_active && product?.promotional_price_usdt;
  const variationPrice = selectedVariation ? Number(selectedVariation.price_usdt) : null;
  const variationStock = selectedVariation ? (variationStocks[selectedVariation.id] ?? 0) : (product?.stock_quantity ?? 0);
  const effectivePrice = variationPrice !== null ? variationPrice : (hasPromo ? Number(product!.promotional_price_usdt) : Number(product?.price_usdt ?? 0));
  const isAvailable = product ? (product.manual_delivery || (selectedVariation ? variationStock > 0 : (product.stock_quantity > 0))) : false;
  const isAccountRecharge = product?.account_recharge === true;
  const maxStock = product?.manual_delivery ? 99 : (selectedVariation ? variationStock : (product?.stock_quantity ?? 0));
  const totalPrice = effectivePrice * detailQuantity;
  const discountPercent = hasPromo && !selectedVariation && product
    ? Math.round((1 - Number(product.promotional_price_usdt) / Number(product.price_usdt)) * 100)
    : 0;

  function handleBuyNow() {
    if (!user) { setShowLoginModal(true); return; }
    if (!userCredit) return;
    checkPendingRatings().then(hasPending => {
      if (hasPending) { setShowRatingModal(true); return; }
      setShowConfirmModal(true);
    });
  }

  async function handleConfirmPurchase(couponCode?: string, rechargeData?: { email: string; password: string; extra_data: string }, useCashback?: boolean, _quantity?: number, variationId?: string | null) {
    if (!user || !userCredit || !product) return;
    setPurchasing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-store-purchase`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          quantity: _quantity || detailQuantity || 1,
          coupon_code: couponCode || null,
          use_cashback: useCashback || false,
          variation_id: variationId || selectedVariation?.id || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Purchase failed');
      setPurchaseSuccessData({ productName: product.name, price: effectivePrice, orderId: result.order_id || '' });
      setShowSuccessModal(true);
      setShowConfirmModal(false);
      loadUserCredit();
    } catch (err: any) {
      alert(err.message || 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  }

  function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: product?.name || 'Product', url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  function navigateToProduct(pid: string) {
    window.history.pushState(null, '', `/product/${pid}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  const navigateToSeller = useCallback(() => {
    if (product?.seller_info?.seller_slug) {
      window.history.pushState(null, '', `/seller/${product.seller_info.seller_slug}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [product]);

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<any> }[] = [
    { key: 'overview', label: tr.overview, icon: Info },
    { key: 'features', label: tr.features, icon: Sparkles },
    { key: 'ratings', label: tr.ratings, icon: Star },
    { key: 'qa', label: tr.qa, icon: MessageCircle },
    { key: 'seller', label: tr.sellerInfo, icon: Store },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader className="h-10 w-10 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Carregando produto...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <p className="text-gray-700 dark:text-gray-300 mb-4 font-medium">{tr.productNotFound}</p>
          <button onClick={onBack} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors">
            {tr.back}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      {/* Breadcrumb / Top bar */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <div className="w-full mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors group"
          >
            <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 flex items-center justify-center transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium hidden sm:inline">{tr.back}</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFavorited(f => !f)}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                favorited
                  ? 'bg-red-50 dark:bg-red-900/30 text-red-500'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500'
              }`}
              title={tr.favorite}
            >
              <Heart className={`h-4 w-4 ${favorited ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={handleShare}
              className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-600 dark:text-gray-300 hover:text-blue-600 flex items-center justify-center transition-colors"
              title={tr.share}
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Share2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="pb-10 px-4 sm:px-6 pt-6">
        <div className="w-full mx-auto max-w-7xl">
          {/* Breadcrumb path */}
          <nav className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-5 flex-wrap">
            <span className="hover:text-blue-600 cursor-pointer">{storeConfig?.store_name || 'Loja'}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="hover:text-blue-600 cursor-pointer capitalize">{product.category}</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-gray-900 dark:text-white font-medium line-clamp-1">{product.name}</span>
          </nav>

          {/* Hero grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            {/* LEFT: Gallery */}
            <div className="lg:col-span-7 xl:col-span-7">
              <div className="lg:sticky lg:top-20 space-y-4">
                {/* Main image card */}
                <div className="relative group rounded-3xl overflow-hidden bg-white dark:bg-gray-900 shadow-xl shadow-gray-200/50 dark:shadow-black/30 border border-gray-200 dark:border-gray-800">
                  <div className="relative aspect-[4/3] sm:aspect-[16/10] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                    {!imageLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader className="h-8 w-8 animate-spin text-gray-400" />
                      </div>
                    )}
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        onLoad={() => setImageLoaded(true)}
                        className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; setImageLoaded(true); }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-500">
                        <Package className="h-20 w-20 text-white/40" />
                      </div>
                    )}
                  </div>

                  {/* Floating badges */}
                  <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-black/60 backdrop-blur-md text-white capitalize shadow-lg">
                      {product.category}
                    </span>
                    {hasPromo && !selectedVariation && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500 text-white shadow-lg flex items-center gap-1">
                        <Tag className="h-3 w-3" /> -{discountPercent}%
                      </span>
                    )}
                  </div>

                  <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                    {!isAvailable && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/90 backdrop-blur-md text-white shadow-lg">
                        {tr.soldOut}
                      </span>
                    )}
                    {isAvailable && !product.manual_delivery && product.stock_quantity > 0 && product.stock_quantity <= 5 && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/90 backdrop-blur-md text-white shadow-lg">
                        {tr.left(product.stock_quantity)}
                      </span>
                    )}
                    {product.auto_delivery && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/90 backdrop-blur-md text-white shadow-lg flex items-center gap-1">
                        <Zap className="h-3 w-3" /> Auto
                      </span>
                    )}
                  </div>
                </div>

                {/* Trust badges row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 flex flex-col items-center text-center gap-1.5">
                    <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">{tr.guaranteed}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{tr.guaranteedDesc}</p>
                  </div>
                  <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 flex flex-col items-center text-center gap-1.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">{tr.securePay}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">100% seguro</p>
                  </div>
                  <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 flex flex-col items-center text-center gap-1.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">{tr.instantDelivery}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{tr.instantDeliveryDesc}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Purchase panel */}
            <div className="lg:col-span-5 xl:col-span-5">
              <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-black/30 border border-gray-200 dark:border-gray-800 p-5 sm:p-6 lg:sticky lg:top-20">
                {/* Delivery badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {product.manual_delivery ? (
                    (product as any).account_recharge ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        <Zap className="h-3.5 w-3.5 mr-1" />{tr.recharge}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        <Truck className="h-3.5 w-3.5 mr-1" />{tr.manualDelivery}
                      </span>
                    )
                  ) : null}
                  {product.renewable && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      <Check className="h-3.5 w-3.5 mr-1" />{tr.renewable}
                    </span>
                  )}
                  {product.delivery_time && !product.auto_delivery && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      <Clock className="h-3.5 w-3.5 mr-1" />{product.delivery_time}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 leading-tight tracking-tight">
                  {product.name}
                </h1>

                {/* Compact rating */}
                <div className="mb-4">
                  <ProductRatingsDisplay productId={product.id} showTitle={false} compact={true} />
                </div>

                {/* Seller row */}
                {product.seller_info && (
                  <button
                    onClick={navigateToSeller}
                    className="w-full mb-4 flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left group"
                  >
                    {product.seller_info.avatar_url ? (
                      <img
                        src={product.seller_info.avatar_url}
                        alt={product.seller_info.business_name}
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-white dark:ring-gray-700"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <span className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold shadow-md">
                        {product.seller_info.business_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{product.seller_info.business_name}</p>
                        {product.seller_info.seller_level && product.seller_info.seller_level >= 3 && (
                          <BadgeCheck className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {product.seller_info.sales_count} {tr.sales}
                        {product.seller_info.seller_level && ` · Nível ${product.seller_info.seller_level}`}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                  </button>
                )}

                {/* Price block */}
                <div className="mb-5 p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-end justify-between flex-wrap gap-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      {hasPromo && !selectedVariation && (
                        <span className="text-base text-gray-400 line-through">{formatPrice(Number(product.price_usdt))}</span>
                      )}
                      <span className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {formatPrice(effectivePrice)}
                      </span>
                    </div>
                    {hasPromo && !selectedVariation && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-500 text-white">
                        -{discountPercent}%
                      </span>
                    )}
                  </div>
                  {!isAccountRecharge && detailQuantity > 1 && (
                    <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800 flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{tr.total} ({detailQuantity}x)</span>
                      <span className="font-bold text-gray-900 dark:text-white">{formatPrice(totalPrice)}</span>
                    </div>
                  )}
                </div>

                {/* Variation Selector */}
                {variations.length > 0 && (
                  <div className="mb-4 relative">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                      {tr.chooseVariation}
                    </h3>
                    <button
                      onClick={() => setShowVariationDropdown(!showVariationDropdown)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 bg-white dark:bg-gray-800 transition-all text-left"
                    >
                      <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {selectedVariation ? selectedVariation.name : tr.select}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {selectedVariation && (
                          <span className="text-base font-bold text-green-600 dark:text-green-400">
                            {formatPrice(Number(selectedVariation.price_usdt))}
                          </span>
                        )}
                        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${showVariationDropdown ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    {showVariationDropdown && (
                      <div className="absolute z-30 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                        {variations.map((variation) => {
                          const isSelected = selectedVariation?.id === variation.id;
                          const varStock = variationStocks[variation.id] ?? 0;
                          const varAvailable = product.manual_delivery || varStock > 0;
                          return (
                            <button
                              key={variation.id}
                              onClick={() => { setSelectedVariation(variation); setShowVariationDropdown(false); }}
                              disabled={!varAvailable}
                              className={`w-full flex items-center justify-between gap-3 px-4 py-3 transition-all text-left ${
                                isSelected
                                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                                  : varAvailable
                                  ? 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-900 dark:text-white'
                                  : 'opacity-50 cursor-not-allowed text-gray-500'
                              }`}
                            >
                              <span className="text-sm font-medium truncate">{variation.name}</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {!product.manual_delivery && (
                                  <span className={`text-xs ${varStock > 5 ? 'text-green-600 dark:text-green-400' : varStock > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500'}`}>
                                    {varStock}
                                  </span>
                                )}
                                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                                  {formatPrice(Number(variation.price_usdt))}
                                </span>
                                {isSelected && <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Quantity */}
                {!isAccountRecharge && (
                  <div className="mb-4 flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{tr.quantity}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailQuantity(Math.max(1, detailQuantity - 1))}
                        disabled={detailQuantity <= 1}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-12 text-center text-base font-bold text-gray-900 dark:text-white">{detailQuantity}</span>
                      <button
                        type="button"
                        onClick={() => setDetailQuantity(Math.min(maxStock, detailQuantity + 1))}
                        disabled={detailQuantity >= maxStock}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Stock info */}
                {!product.manual_delivery && variations.length === 0 && (
                  <div className="mb-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{tr.availability}</span>
                      <span className={`font-bold text-sm flex items-center gap-1.5 ${
                        variationStock > 5 ? 'text-green-600 dark:text-green-400'
                        : variationStock > 0 ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${variationStock > 5 ? 'bg-green-500' : variationStock > 0 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                        {tr.inStock(variationStock)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Buy button */}
                <button
                  onClick={handleBuyNow}
                  disabled={!isAvailable || purchasing}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-base transition-all ${
                    !isAvailable
                      ? 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-500 cursor-not-allowed'
                      : purchasing
                      ? 'bg-gray-400 text-white cursor-wait'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-xl shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98]'
                  }`}
                >
                  {purchasing ? (
                    <Loader className="h-5 w-5 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-5 w-5" />
                  )}
                  <span>
                    {!isAvailable ? tr.soldOut
                      : user ? tr.buyNow
                      : tr.signInToBuy}
                  </span>
                  {isAvailable && !purchasing && <ArrowRight className="h-4 w-4" />}
                </button>
                <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
                  {user ? tr.balance(userCredit?.balance || 0) : tr.signInOrRegister}
                </p>
              </div>
            </div>
          </div>

          {/* Tabbed content section */}
          <div className="mt-8 bg-white dark:bg-gray-900 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            {/* Tab bar */}
            <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-800 scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-5 py-4 text-sm font-medium whitespace-nowrap transition-all relative ${
                      isActive
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="p-5 sm:p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {product.description && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 uppercase tracking-wider flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-500" />
                        {tr.description}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line text-sm">
                        {product.description}
                      </p>
                    </div>
                  )}

                  {product.delivery_time && !product.auto_delivery && (
                    <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                        <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{tr.estimatedDelivery}</p>
                        <p className="text-sm text-blue-600 dark:text-blue-400">{product.delivery_time}</p>
                      </div>
                    </div>
                  )}

                  {/* Specifications grid */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="h-4 w-4 text-blue-500" />
                      {tr.specifications}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <SpecItem icon={Tag} label={tr.category} value={<span className="capitalize">{product.category}</span>} />
                      <SpecItem icon={Truck} label={tr.delivery} value={product.manual_delivery ? tr.manual : tr.auto} />
                      <SpecItem icon={Package} label={tr.stock} value={product.manual_delivery ? '∞' : `${product.stock_quantity}`} />
                      <SpecItem icon={Check} label={tr.renewable} value={product.renewable ? tr.yes : tr.no} />
                      <SpecItem icon={Zap} label="Auto Delivery" value={product.auto_delivery ? tr.yes : tr.no} />
                      <SpecItem icon={ShieldCheck} label={tr.guaranteed} value={tr.yes} />
                    </div>
                  </div>

                  {/* Features inline (overview also shows) */}
                  {product.features && product.features.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-500" />
                        {tr.highlights}
                      </h3>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {product.features.map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-sm">
                            <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                            </div>
                            <span className="text-gray-700 dark:text-gray-300">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'features' && (
                <div>
                  {product.features && product.features.length > 0 ? (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {product.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-blue-50/50 dark:from-gray-800/50 dark:to-blue-900/10 border border-gray-200 dark:border-gray-800 text-sm">
                          <div className="w-8 h-8 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                            <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          <span className="text-gray-700 dark:text-gray-300 pt-1">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">—</p>
                  )}
                </div>
              )}

              {activeTab === 'ratings' && (
                <ProductRatingsDisplay productId={product.id} showTitle={true} compact={false} />
              )}

              {activeTab === 'qa' && (
                <ProductQABlock productId={product.id} sellerId={product.seller_info?.seller_id || null} />
              )}

              {activeTab === 'seller' && (
                <div className="space-y-6">
                  {product.seller_info ? (
                    <>
                      <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800">
                        {product.seller_info.avatar_url ? (
                          <img
                            src={product.seller_info.avatar_url}
                            alt={product.seller_info.business_name}
                            className="h-16 w-16 rounded-full object-cover ring-2 ring-white dark:ring-gray-700"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <span className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                            {product.seller_info.business_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate">{product.seller_info.business_name}</h3>
                            {product.seller_info.seller_level && product.seller_info.seller_level >= 3 && (
                              <BadgeCheck className="h-5 w-5 text-blue-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                            <TrendingUp className="h-3.5 w-3.5" />
                            {product.seller_info.sales_count} {tr.sales}
                            {product.seller_info.seller_level && (
                              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                Nível {product.seller_info.seller_level}
                              </span>
                            )}
                          </p>
                        </div>
                        {product.seller_info.seller_slug && (
                          <button
                            onClick={navigateToSeller}
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors flex items-center gap-1.5 flex-shrink-0"
                          >
                            <Store className="h-4 w-4" />
                            <span className="hidden sm:inline">Ver loja</span>
                          </button>
                        )}
                      </div>
                      {product.seller_info.seller_id && (
                        <SellerReputation sellerId={product.seller_info.seller_id} sellerName={product.seller_info.business_name} />
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">—</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div className="mt-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tr.relatedProducts}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{product.category}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
                {relatedProducts.map((rp) => {
                  const rpAvail = rp.manual_delivery || rp.stock_quantity > 0;
                  const rpPromo = rp.promotion_active && rp.promotional_price_usdt;
                  return (
                    <div
                      key={rp.id}
                      onClick={() => navigateToProduct(rp.id)}
                      className="group relative bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 dark:border-gray-800 hover:-translate-y-1"
                    >
                      <div className="relative aspect-video overflow-hidden bg-gray-100 dark:bg-gray-800">
                        {rp.image_url ? (
                          <img src={rp.image_url} alt={rp.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-cyan-500">
                            <Package className="w-8 h-8 text-white/40" />
                          </div>
                        )}
                        {!rpAvail && (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-xs font-medium bg-red-500/90 backdrop-blur-sm text-white">
                            {tr.soldOut}
                          </span>
                        )}
                        {rpPromo && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-xs font-bold bg-red-500 text-white">
                            -{Math.round((1 - Number(rp.promotional_price_usdt) / Number(rp.price_usdt)) * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="p-3 lg:p-4">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1.5 line-clamp-1">{rp.name}</h3>
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

      {/* Mobile sticky purchase bar */}
      {stickyBarVisible && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between gap-3 shadow-2xl">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{product.name}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{formatPrice(effectivePrice)}</p>
          </div>
          <button
            onClick={handleBuyNow}
            disabled={!isAvailable || purchasing}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              !isAvailable
                ? 'bg-gray-200 dark:bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg'
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            {!isAvailable ? tr.soldOut : user ? tr.buyNow : tr.signInToBuy}
          </button>
        </div>
      )}

      {/* Login Modal */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onLoginSuccess={onGetStarted} />

      {/* Purchase Confirm Modal */}
      {showConfirmModal && product && (
        <PurchaseConfirmModal
          isOpen={showConfirmModal}
          product={product}
          userBalance={userCredit?.balance || 0}
          onConfirm={handleConfirmPurchase}
          onCancel={() => setShowConfirmModal(false)}
          isLoading={purchasing}
          variationId={selectedVariation?.id || null}
          variationName={selectedVariation?.name || null}
          variationPrice={selectedVariation ? Number(selectedVariation.price_usdt) : null}
          variations={variations}
          initialQuantity={detailQuantity}
          onCheckout={(qty, varId) => {
            setShowConfirmModal(false);
            const vid = varId || selectedVariation?.id || '';
            sessionStorage.setItem('checkout_data', JSON.stringify({ productId: product.id, variationId: vid, quantity: qty }));
            window.history.pushState(null, '', `/checkout/${product.id}`);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
        />
      )}

      {/* Rating Modal */}
      {showRatingModal && pendingRating && (
        <ProductRatingModal
          isOpen={showRatingModal}
          onClose={() => { setShowRatingModal(false); setPendingRating(null); }}
          productId={pendingRating.productId}
          productName={pendingRating.productName}
          orderId={pendingRating.orderId}
          onRatingSubmitted={() => { setShowRatingModal(false); setPendingRating(null); }}
          force={true}
        />
      )}

      {/* Success Modal */}
      {showSuccessModal && purchaseSuccessData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{tr.purchaseComplete}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{tr.youPurchased(purchaseSuccessData.productName)}</p>
            <button
              onClick={() => { setShowSuccessModal(false); onNavigate?.('purchases'); }}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-xl transition-colors"
            >
              {tr.viewMyPurchases}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SpecItem({ icon: Icon, label, value }: { icon: React.ComponentType<any>; label: string; value: React.ReactNode }) {
  return (
    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center gap-1.5 mb-1 text-gray-500 dark:text-gray-400">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
