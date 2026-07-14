import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, ArrowRight, Package, Check, Truck, ShoppingCart, Star,
  AlertCircle, Loader, UserCheck, CreditCard,
  Share2, CheckCircle2
} from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { useAuth } from './AuthProvider';
import { supabase, StoreProduct } from '../lib/supabase';
import { LoginModal } from './LoginModal';
import { Footer } from './Footer';
import { ProductRatingsDisplay } from './ProductRatingsDisplay';
import { PurchaseConfirmModal } from './PurchaseConfirmModal';
import { ProductRatingModal } from './ProductRatingModal';

interface ProductWithSeller extends StoreProduct {
  seller_info?: {
    business_name: string;
    sales_count: number;
    seller_slug?: string;
    avatar_url?: string | null;
  };
  is_seller_product?: boolean;
  seller_application_id?: string;
  promotional_price_usdt?: number | null;
  promotion_active?: boolean;
  manual_delivery?: boolean;
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

export function ProductDetailPage({ productId, onBack, onGetStarted, onNavigate }: ProductDetailPageProps) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const [storeConfig, setStoreConfig] = useState<{ store_name?: string; store_logo_url?: string; store_description?: string } | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<ProductWithSeller[]>([]);
  const [product, setProduct] = useState<ProductWithSeller | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userCredit, setUserCredit] = useState<UserCredit | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [pendingRating, setPendingRating] = useState<{ productId: string; productName: string } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [purchaseSuccessData, setPurchaseSuccessData] = useState<{ productName: string; price: number; orderId: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    loadProduct();
    loadStoreConfig();
  }, [productId]);

  useEffect(() => {
    if (product) {
      loadRelatedProducts();
    }
  }, [product]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [productId]);

  useEffect(() => {
    if (user) {
      loadUserCredit();
    }
  }, [user]);

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
      if (!data) {
        setError('Product not found');
        return;
      }

      let productData: ProductWithSeller = { ...data } as ProductWithSeller;

      // Fetch per-product sales count
      const { data: productSalesCount } = await supabase.rpc('get_product_sales_count', { product_uuid: data.id });
      const salesCount = Number(productSalesCount) || 0;

      if (data.seller_id) {
        const { data: sellerData } = await supabase
          .from('profiles')
          .select('full_name, seller_slug, avatar_url, username')
          .eq('id', data.seller_id)
          .maybeSingle();
        productData.seller_info = {
          business_name: sellerData?.full_name || sellerData?.username || sellerData?.seller_slug || 'Vendedor',
          sales_count: salesCount,
          seller_slug: sellerData?.seller_slug,
          avatar_url: sellerData?.avatar_url || null,
        };
      } else {
        const { data: adminProfile } = await supabase
          .from('profiles')
          .select('id, full_name, seller_slug, avatar_url')
          .eq('role', 'admin')
          .maybeSingle();
        productData.seller_info = {
          business_name: adminProfile?.full_name || 'Admin',
          sales_count: salesCount,
          seller_slug: adminProfile?.seller_slug,
          avatar_url: adminProfile?.avatar_url || null,
        };
      }

      setProduct(productData);
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
        .select('id, product_id, products(name)')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .eq('has_rated', false)
        .limit(1);
      if (data && data.length > 0) {
        const item = data[0] as any;
        setPendingRating({ productId: item.product_id, productName: item.products?.name || '' });
        return true;
      }
      return false;
    } catch { return false; }
  }

  const hasPromo = product?.promotion_active && product?.promotional_price_usdt;
  const effectivePrice = hasPromo ? Number(product!.promotional_price_usdt) : Number(product?.price_usdt ?? 0);
  const isAvailable = product ? (product.manual_delivery || product.stock_quantity > 0) : false;

  function handleBuyNow() {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!userCredit) return;

    checkPendingRatings().then(hasPending => {
      if (hasPending) {
        setShowRatingModal(true);
        return;
      }
      const unitPrice = hasPromo ? Number(product!.promotional_price_usdt) : product!.price_usdt;
      const totalPrice = unitPrice * quantity;
      if (userCredit.balance < totalPrice) {
        onNavigate?.('credits', { presetAmount: totalPrice });
        return;
      }
      setShowConfirmModal(true);
    });
  }

  async function handleConfirmPurchase(couponCode?: string, rechargeData?: { email: string; password: string; extra_data: string }, useCashback?: boolean) {
    if (!user || !userCredit || !product) return;
    setPurchasing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-store-purchase`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: product.id,
          quantity: quantity,
          coupon_code: couponCode || null,
          use_cashback: useCashback || false,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Purchase failed');

      setPurchaseSuccessData({ productName: product.name, price: effectivePrice * quantity, orderId: result.order_id || '' });
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
    window.location.hash = `product/${pid}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <Loader className="h-10 w-10 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {t.language === 'pt' ? 'Produto nao encontrado' : t.language === 'en' ? 'Product not found' : 'Producto no encontrado'}
          </p>
          <button onClick={onBack} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
            {t.language === 'pt' ? 'Voltar a loja' : t.language === 'en' ? 'Back to store' : 'Volver a la tienda'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors">
      {/* Back + Share bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">
            {t.language === 'pt' ? 'Voltar a loja' : t.language === 'en' ? 'Back to store' : 'Volver a la tienda'}
          </span>
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm font-medium"
        >
          {copied ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Share2 className="h-5 w-5" />}
          <span className="hidden sm:inline">{copied ? (t.language === 'pt' ? 'Copiado!' : 'Copied!') : (t.language === 'pt' ? 'Compartilhar' : t.language === 'en' ? 'Share' : 'Compartir')}</span>
        </button>
      </div>

      {/* Product Detail Content */}
      <main className="pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Product Image */}
            <div className="relative">
              <div className="aspect-[16/10] bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                    <Package className="h-16 w-16 text-white opacity-50" />
                  </div>
                )}
              </div>
              {/* Category badge */}
              <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-black/50 backdrop-blur-sm text-white capitalize">
                {product.category}
              </span>
              {/* Availability badge */}
              {!isAvailable && (
                <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/90 backdrop-blur-sm text-white">
                  {t.language === 'pt' ? 'Esgotado' : t.language === 'en' ? 'Sold Out' : 'Agotado'}
                </span>
              )}
              {isAvailable && !product.manual_delivery && product.stock_quantity > 0 && product.stock_quantity <= 5 && (
                <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/90 backdrop-blur-sm text-white">
                  {t.language === 'pt' ? `Restam ${product.stock_quantity}` : t.language === 'en' ? `${product.stock_quantity} left` : `Quedan ${product.stock_quantity}`}
                </span>
              )}
            </div>

            {/* Product Info */}
            <div className="flex flex-col">
              {/* Delivery badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                {product.manual_delivery ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    <Truck className="h-3.5 w-3.5 mr-1" />
                    {t.language === 'pt' ? 'Entrega Manual' : t.language === 'en' ? 'Manual Delivery' : 'Entrega Manual'}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    <Truck className="h-3.5 w-3.5 mr-1" />
                    {t.language === 'pt' ? 'Entrega Automatica' : t.language === 'en' ? 'Auto Delivery' : 'Entrega Automatica'}
                  </span>
                )}
                {product.renewable && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {t.language === 'pt' ? 'Renovavel' : t.language === 'en' ? 'Renewable' : 'Renovable'}
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {product.name}
              </h1>

              {/* Seller info with avatar */}
              {product.seller_info && (
                <button
                  onClick={() => {
                    if (product.seller_info?.seller_slug) {
                      window.location.hash = `seller/${product.seller_info.seller_slug}`;
                    }
                  }}
                  className="self-start mb-3 inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {product.seller_info.avatar_url ? (
                    <img
                      src={product.seller_info.avatar_url}
                      alt={product.seller_info.business_name}
                      className="h-7 w-7 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                      {product.seller_info.business_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="font-medium text-gray-700 dark:text-gray-300">{product.seller_info.business_name}</span>
                  <span className="text-gray-400">·</span>
                  <span>{product.seller_info.sales_count} {t.language === 'pt' ? 'vendas' : t.language === 'en' ? 'sales' : 'ventas'}</span>
                </button>
              )}

              {/* Price */}
              <div className="flex items-baseline gap-2 mb-3">
                {hasPromo && (
                  <span className="text-lg text-gray-400 line-through">
                    {formatPrice(Number(product.price_usdt))}
                  </span>
                )}
                <span className={`text-3xl font-bold ${hasPromo ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
                  {formatPrice(effectivePrice)}
                </span>
                {quantity > 1 && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {t.language === 'pt' ? `Total: ${formatPrice(effectivePrice * quantity)}` : t.language === 'en' ? `Total: ${formatPrice(effectivePrice * quantity)}` : `Total: ${formatPrice(effectivePrice * quantity)}`}
                  </span>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5 uppercase tracking-wide">
                    {t.language === 'pt' ? 'Descricao' : t.language === 'en' ? 'Description' : 'Descripcion'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Features */}
              {product.features && product.features.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 uppercase tracking-wide">
                    {t.language === 'pt' ? 'Recursos' : t.language === 'en' ? 'Features' : 'Caracteristicas'}
                  </h3>
                  <ul className="space-y-1.5">
                    {product.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Stock Info */}
              {!product.manual_delivery && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                      {t.language === 'pt' ? 'Disponibilidade' : t.language === 'en' ? 'Availability' : 'Disponibilidad'}
                    </span>
                    <span className={`font-bold text-base ${
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
              <div className="mb-4">
                <ProductRatingsDisplay productId={product.id} showTitle={true} compact={true} />
              </div>

              {/* Quantity Selector */}
              {/* Action Buttons */}
              <div className="mt-auto space-y-2">
                <button
                  onClick={handleBuyNow}
                  disabled={!isAvailable || purchasing}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-base transition-all ${
                    !isAvailable
                      ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : purchasing
                      ? 'bg-gray-400 text-white cursor-wait'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/30 hover:scale-[1.02]'
                  }`}
                >
                  {purchasing ? (
                    <Loader className="h-5 w-5 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-5 w-5" />
                  )}
                  <span>
                    {!isAvailable
                      ? (t.language === 'pt' ? 'Esgotado' : t.language === 'en' ? 'Sold Out' : 'Agotado')
                      : user
                      ? (t.language === 'pt' ? 'Comprar Agora' : t.language === 'en' ? 'Buy Now' : 'Comprar Ahora')
                      : (t.language === 'pt' ? 'Entrar para Comprar' : t.language === 'en' ? 'Sign In to Buy' : 'Iniciar Sesion para Comprar')
                    }
                  </span>
                  {isAvailable && !purchasing && <ArrowRight className="h-4 w-4" />}
                </button>
                <p className="text-center text-xs text-gray-400 dark:text-gray-500">
                  {user
                    ? (t.language === 'pt'
                      ? `Saldo: ${formatPrice(userCredit?.balance || 0)}`
                      : `Balance: ${formatPrice(userCredit?.balance || 0)}`)
                    : (t.language === 'pt'
                      ? 'Entre ou cadastre-se para completar sua compra'
                      : t.language === 'en'
                      ? 'Sign in or register to complete your purchase'
                      : 'Inicia sesion o registrate para completar tu compra')
                    }
                </p>
              </div>
            </div>
          </div>

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {t.language === 'pt' ? 'Produtos Relacionados' : t.language === 'en' ? 'Related Products' : 'Productos Relacionados'}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
                {relatedProducts.map((rp) => {
                  const rpAvail = rp.manual_delivery || rp.stock_quantity > 0;
                  const rpPromo = rp.promotion_active && rp.promotional_price_usdt;
                  return (
                    <div
                      key={rp.id}
                      onClick={() => navigateToProduct(rp.id)}
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

      {/* Purchase Confirm Modal */}
      {showConfirmModal && product && (
        <PurchaseConfirmModal
          isOpen={showConfirmModal}
          product={product}
          userBalance={userCredit?.balance || 0}
          onConfirm={handleConfirmPurchase}
          onCancel={() => setShowConfirmModal(false)}
          isLoading={purchasing}
        />
      )}

      {/* Rating Modal */}
      {showRatingModal && pendingRating && (
        <ProductRatingModal
          isOpen={showRatingModal}
          onClose={() => { setShowRatingModal(false); setPendingRating(null); }}
          productId={pendingRating.productId}
          productName={pendingRating.productName}
          onRated={() => { setShowRatingModal(false); setPendingRating(null); }}
        />
      )}

      {/* Success Modal */}
      {showSuccessModal && purchaseSuccessData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {t.language === 'pt' ? 'Compra Realizada!' : t.language === 'en' ? 'Purchase Complete!' : 'Compra Completada!'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t.language === 'pt' ? `Voce comprou ${purchaseSuccessData.productName}` : t.language === 'en' ? `You purchased ${purchaseSuccessData.productName}` : `Compraste ${purchaseSuccessData.productName}`}
            </p>
            <button
              onClick={() => { setShowSuccessModal(false); onNavigate?.('purchases'); }}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              {t.language === 'pt' ? 'Ver Minhas Compras' : t.language === 'en' ? 'View My Purchases' : 'Ver Mis Compras'}
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
