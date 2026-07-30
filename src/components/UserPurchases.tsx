import React, { useState, useEffect } from 'react';
import {
  Package, Calendar, Clock, AlertTriangle, ChevronLeft, ChevronRight,
  Star, HelpCircle, DollarSign, Truck, CheckCircle,
  ExternalLink, ShieldAlert, Layers, ShoppingBag, CreditCard,
  Loader2, Tag,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { PurchaseDetailPage } from './PurchaseDetailPage';
import { ProductRatingModal } from './ProductRatingModal';
import { PurchaseHelpModal } from './PurchaseHelpModal';
import ProductImage from './ProductImage';

interface UserPurchase {
  id: string;
  user_id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  purchase_price: number;
  credentials: any;
  purchase_date: string;
  expires_at?: string;
  expired?: boolean;
  created_at: string;
  read_accounts?: number[];
  store_products?: {
    image_url?: string;
    category: string;
  };
  store_orders?: {
    status: string;
    cancelled_at?: string;
    cancellation_reason?: string;
    discount_amount?: number;
    cashback_used?: number;
    coupon_id?: string;
    seller_id?: string;
  };
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function calculateExpiryDate(purchaseDate: string): Date {
  return new Date(new Date(purchaseDate).getTime() + THIRTY_DAYS_MS);
}

function isExpired(purchaseDate: string): boolean {
  return Date.now() > calculateExpiryDate(purchaseDate).getTime();
}

function isCancelled(purchase: UserPurchase): boolean {
  return purchase.store_orders?.status === 'cancelled';
}

function isDisputed(purchase: UserPurchase): boolean {
  return purchase.store_orders?.status === 'disputed';
}

function getDaysRemaining(purchaseDate: string): number {
  return Math.ceil((calculateExpiryDate(purchaseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

type ExpiryStatus = {
  status: 'expired' | 'expiring' | 'warning' | 'active';
  label: string;
  dotColor: string;
  textColor: string;
};

function getExpiryStatus(purchaseDate: string, lang: string): ExpiryStatus {
  const days = getDaysRemaining(purchaseDate);
  if (days <= 0) return {
    status: 'expired',
    label: lang === 'pt' ? 'Expirado' : lang === 'en' ? 'Expired' : 'Expirado',
    dotColor: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400',
  };
  if (days <= 3) return {
    status: 'expiring',
    label: lang === 'pt' ? `${days}d` : lang === 'en' ? `${days}d` : `${days}d`,
    dotColor: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400',
  };
  if (days <= 7) return {
    status: 'warning',
    label: lang === 'pt' ? `${days}d` : lang === 'en' ? `${days}d` : `${days}d`,
    dotColor: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400',
  };
  return {
    status: 'active',
    label: lang === 'pt' ? `${days}d` : lang === 'en' ? `${days}d` : `${days}d`,
    dotColor: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400',
  };
}

export function UserPurchases() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const lang = t.language;
  const tr = (pt: string, en: string, es: string) => lang === 'pt' ? pt : lang === 'en' ? en : es;

  const [purchases, setPurchases] = useState<UserPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetailPage, setShowDetailPage] = useState(false);
  const [detailPageId, setDetailPageId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [purchasesPerPage] = useState(8);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedPurchaseForRating, setSelectedPurchaseForRating] = useState<UserPurchase | null>(null);
  const [userRatings, setUserRatings] = useState<Record<string, boolean>>({});
const [showHelpModal, setShowHelpModal] = useState(false);
  const [selectedPurchaseForHelp, setSelectedPurchaseForHelp] = useState<UserPurchase | null>(null);
  const [sellerIdForHelp, setSellerIdForHelp] = useState<string | null>(null);
  const [helpTicketStatuses, setHelpTicketStatuses] = useState<Record<string, { status: string; escalated: boolean }>>({});
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredPurchases = purchases.filter(p => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'cancelled') return isCancelled(p);
    if (statusFilter === 'disputed') return isDisputed(p);
    if (statusFilter === 'expired') return isExpired(p.purchase_date) && !isCancelled(p);
    return p.store_orders?.status === statusFilter;
  });

  const filterTabs = [
    { key: 'all', label: tr('Todos', 'All', 'Todos'), count: purchases.length },
    { key: 'paid', label: tr('Pagos', 'Paid', 'Pagados'), count: purchases.filter(p => p.store_orders?.status === 'paid').length },
    { key: 'delivered', label: tr('Entregues', 'Delivered', 'Entregados'), count: purchases.filter(p => p.store_orders?.status === 'delivered').length },
    { key: 'completed', label: tr('Concluídos', 'Completed', 'Completados'), count: purchases.filter(p => p.store_orders?.status === 'completed').length },
    { key: 'expired', label: tr('Expirados', 'Expired', 'Expirados'), count: purchases.filter(p => isExpired(p.purchase_date) && !isCancelled(p)).length },
    { key: 'cancelled', label: tr('Cancelados', 'Cancelled', 'Cancelados'), count: purchases.filter(p => isCancelled(p)).length },
  ];

  useEffect(() => {
    if (user) {
      loadUserPurchases();
      loadUserRatings();
      const detailId = sessionStorage.getItem('purchase_detail_id');
      if (detailId) {
        setDetailPageId(detailId);
        setShowDetailPage(true);
        sessionStorage.removeItem('purchase_detail_id');
      }
    }
  }, [user]);

  // Listen for open-order-detail events from chat order reference cards
  useEffect(() => {
    const handleOpenOrderDetail = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.orderId) return;
      // Find the user_purchase that matches this store order_id
      const purchase = purchases.find(p => p.order_id === detail.orderId);
      if (purchase) {
        setDetailPageId(purchase.id);
        setShowDetailPage(true);
        window.history.pushState(null, '', `/purchases/${purchase.id}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      } else {
        // If not found yet, store it and reload purchases to find it
        sessionStorage.setItem('purchase_detail_id', detail.orderId);
        if (user) loadUserPurchases();
      }
    };
    window.addEventListener('open-order-detail', handleOpenOrderDetail as EventListener);
    return () => window.removeEventListener('open-order-detail', handleOpenOrderDetail as EventListener);
  }, [purchases, user]);

  useEffect(() => { setCurrentPage(1); }, [statusFilter, purchases.length]);

  async function loadHelpTicketStatuses(orderIds: string[]) {
    if (!user || orderIds.length === 0) return;
    try {
      const { data } = await supabase
        .from('seller_support_tickets')
        .select('order_id, status, escalated')
        .eq('customer_id', user.id)
        .in('order_id', orderIds);
      if (data) {
        const map: Record<string, { status: string; escalated: boolean }> = {};
        data.forEach(t => {
          if (t.order_id && !map[t.order_id]) {
            map[t.order_id] = { status: t.status, escalated: !!t.escalated };
          }
        });
        setHelpTicketStatuses(map);
      }
    } catch { /* ignore */ }
  }

  async function loadUserPurchases() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_purchases')
        .select(`
          *,
          store_products!user_purchases_product_id_fkey (
            image_url, category
          ),
          store_orders!user_purchases_order_id_fkey (
            status, cancelled_at, cancellation_reason,
            discount_amount, cashback_used, coupon_id, seller_id
          )
        `)
        .eq('user_id', user.id)
        .order('purchase_date', { ascending: false });

      if (error) throw error;
      const purchaseData = data || [];
      setPurchases(purchaseData);
      const orderIds = purchaseData.map(p => p.order_id).filter(Boolean) as string[];
      if (orderIds.length > 0) loadHelpTicketStatuses(orderIds);
    } catch (err) {
      console.error('Error loading purchases:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadUserRatings() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('product_ratings')
        .select('product_id, order_id')
        .eq('user_id', user.id);
      if (data) {
        const map: Record<string, boolean> = {};
        data.forEach(r => {
          const key = r.order_id ? `${r.product_id}-${r.order_id}` : r.product_id;
          map[key] = true;
        });
        setUserRatings(map);
      }
    } catch { /* ignore */ }
  }

  function handleRateProduct(purchase: UserPurchase) {
    setSelectedPurchaseForRating(purchase);
    setShowRatingModal(true);
  }

  function handleRatingSubmitted() {
    setShowRatingModal(false);
    setSelectedPurchaseForRating(null);
    loadUserRatings();
    loadUserPurchases();
  }

function handleViewDetails(purchase: UserPurchase) {
    setDetailPageId(purchase.id);
    setShowDetailPage(true);
    window.history.pushState(null, '', `/purchases/${purchase.id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  function handleHelpClick(purchase: UserPurchase) {
    setSelectedPurchaseForHelp(purchase);
    setSellerIdForHelp(purchase.store_orders?.seller_id || null);
    setShowHelpModal(true);
  }

  const totalPages = Math.ceil(filteredPurchases.length / purchasesPerPage);
  const startIndex = (currentPage - 1) * purchasesPerPage;
  const currentPurchases = filteredPurchases.slice(startIndex, startIndex + purchasesPerPage);

  if (showDetailPage && detailPageId) {
    return (
      <PurchaseDetailPage
        purchaseId={detailPageId}
        onBack={() => {
          setShowDetailPage(false);
          setDetailPageId(null);
          window.history.pushState(null, '', '/purchases');
          window.dispatchEvent(new PopStateEvent('popstate'));
          if (user) loadUserPurchases();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {tr('Carregando...', 'Loading...', 'Cargando...')}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
          <ShoppingBag className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{t.myPurchases}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {purchases.length} {tr('compra(s)', 'purchase(s)', 'compra(s)')}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              statusFilter === tab.key
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label}
            <span className={`text-[10px] px-1 rounded ${statusFilter === tab.key ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Empty States */}
      {purchases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{t.noPurchasesFound}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t.noStoreOrders}</p>
        </div>
      ) : filteredPurchases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {tr('Nenhuma compra neste filtro', 'No purchases in this filter', 'Ninguna compra en este filtro')}
          </p>
        </div>
      ) : (
        <>
          {/* Purchase Rows */}
          <div className="space-y-2">
            {currentPurchases.map(purchase => {
              const cancelled = isCancelled(purchase);
              const disputed = isDisputed(purchase);
              const expired = isExpired(purchase.purchase_date);
              const expiryStatus = getExpiryStatus(purchase.purchase_date, lang);
              const hasRating = userRatings[`${purchase.product_id}-${purchase.order_id}`] || userRatings[purchase.product_id];
              const helpStatus = helpTicketStatuses[purchase.order_id];

              const statusMeta = cancelled
                ? { label: tr('Cancelado', 'Cancelled', 'Cancelado'), color: 'text-red-500', dot: 'bg-red-500' }
                : disputed
                ? { label: tr('Disputa', 'Dispute', 'Disputa'), color: 'text-orange-500', dot: 'bg-orange-500' }
                : expired
                ? { label: tr('Expirado', 'Expired', 'Expirado'), color: 'text-gray-400', dot: 'bg-gray-400' }
                : purchase.store_orders?.status === 'completed'
                ? { label: tr('Concluído', 'Completed', 'Completado'), color: 'text-green-500', dot: 'bg-green-500' }
                : purchase.store_orders?.status === 'delivered'
                ? { label: tr('Entregue', 'Delivered', 'Entregado'), color: 'text-blue-500', dot: 'bg-blue-500' }
                : { label: tr('Pago', 'Paid', 'Pagado'), color: 'text-cyan-500', dot: 'bg-cyan-500' };

              return (
                <div
                  key={purchase.id}
                  className={`group bg-white dark:bg-gray-800 rounded-xl border transition-all hover:shadow-md ${
                    cancelled ? 'border-red-200 dark:border-red-900/40' : disputed ? 'border-orange-200 dark:border-orange-900/40' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3">
                    {/* Thumbnail + Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Thumbnail */}
                      <div className="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0">
                        <ProductImage
                          src={purchase.store_products?.image_url}
                          alt={purchase.product_name}
                          rounded="rounded-lg"
                          grayscale={cancelled || expired}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-sm font-semibold truncate ${cancelled || expired ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>
                          {purchase.product_name}
                        </h3>
                        <div className="flex items-center gap-2 sm:gap-3 text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex-wrap">
                          <span className={`flex items-center gap-1 font-medium ${statusMeta.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                            {statusMeta.label}
                          </span>
                          {purchase.credentials?.variation_name && (
                            <span className="hidden sm:flex items-center gap-0.5 text-purple-500">
                              <Layers className="w-3 h-3" />
                              {purchase.credentials.variation_name}
                            </span>
                          )}
                          <span className="flex items-center gap-0.5">
                            <Calendar className="w-3 h-3" />
                            {new Date(purchase.purchase_date).toLocaleDateString(lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : 'es-ES', { day: '2-digit', month: 'short' })}
                          </span>
                          {!cancelled && !disputed && (
                            <span className={`flex items-center gap-0.5 ${expiryStatus.textColor}`}>
                              <Clock className="w-3 h-3" />
                              {expiryStatus.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Price + Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-700">
                      {/* Price */}
                      <p className="text-sm font-bold text-gray-900 dark:text-white sm:text-right">
                        {formatPrice(purchase.purchase_price)}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5">
                        {!cancelled && !expired && (
                          <button
                            onClick={() => handleRateProduct(purchase)}
                            disabled={hasRating}
                            className={`p-2 rounded-lg transition-colors ${
                              hasRating
                                ? 'text-amber-400 cursor-default'
                                : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                            }`}
                            title={hasRating ? tr('Avaliado', 'Rated', 'Calificado') : tr('Avaliar', 'Rate', 'Calificar')}
                          >
                            <Star className={`w-4 h-4 ${hasRating ? 'fill-current' : ''}`} />
                          </button>
                        )}

                        <button
                          onClick={() => handleHelpClick(purchase)}
                          className={`p-2 rounded-lg transition-colors relative ${
                            helpStatus?.escalated
                              ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                              : helpStatus?.status === 'resolved'
                              ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                              : helpStatus
                              ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                          title={tr('Ajuda', 'Help', 'Ayuda')}
                        >
                          <HelpCircle className="w-4 h-4" />
                          {helpStatus && !helpStatus.escalated && helpStatus.status !== 'resolved' && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                          )}
                        </button>

                        <button
                          onClick={() => handleViewDetails(purchase)}
                          className={`flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                            cancelled
                              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                              : expired
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                              : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-200'
                          }`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{tr('Detalhes', 'Details', 'Detalles')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((page, idx, arr) => (
                  <React.Fragment key={page}>
                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                      <span className="text-gray-400 px-1">…</span>
                    )}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                        currentPage === page
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                          : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
                ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showRatingModal && selectedPurchaseForRating && (
        <ProductRatingModal
          isOpen={showRatingModal}
          onClose={() => { setShowRatingModal(false); setSelectedPurchaseForRating(null); }}
          productId={selectedPurchaseForRating.product_id}
          productName={selectedPurchaseForRating.product_name}
          orderId={selectedPurchaseForRating.order_id}
          onRatingSubmitted={handleRatingSubmitted}
        />
      )}

      <PurchaseHelpModal
        isOpen={showHelpModal}
        onClose={() => {
          setShowHelpModal(false);
          setSelectedPurchaseForHelp(null);
          setSellerIdForHelp(null);
          if (user) loadUserPurchases();
        }}
        purchase={selectedPurchaseForHelp}
        sellerId={sellerIdForHelp}
      />
    </div>
  );
}


