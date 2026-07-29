import React, { useState, useEffect } from 'react';
import {
  Package, Calendar, Clock, AlertTriangle, ChevronLeft, ChevronRight,
  Star, RefreshCw, HelpCircle, DollarSign, Truck, CheckCircle, X,
  ExternalLink, ShieldAlert, Layers, ShoppingBag, CreditCard,
  TrendingUp, Loader2, Sparkles, Tag, Zap,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { PurchaseDetailPage } from './PurchaseDetailPage';
import { ProductRatingModal } from './ProductRatingModal';
import { PurchaseHelpModal } from './PurchaseHelpModal';

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

function isOlderThan30Days(purchaseDate: string): boolean {
  return Date.now() - new Date(purchaseDate).getTime() > THIRTY_DAYS_MS;
}

function canRenewPurchase(purchase: UserPurchase): boolean {
  if (purchase.store_orders?.status === 'paid' ||
      purchase.store_orders?.status === 'delivered' ||
      purchase.store_orders?.status === 'completed' ||
      isCancelled(purchase)) return false;
  if (isOlderThan30Days(purchase.purchase_date)) return false;
  return true;
}

type ExpiryStatus = {
  status: 'expired' | 'expiring' | 'warning' | 'active';
  label: string;
  color: string;
  dotColor: string;
  textColor: string;
  bgColor: string;
};

function getExpiryStatus(purchaseDate: string, lang: string): ExpiryStatus {
  const days = getDaysRemaining(purchaseDate);
  if (days <= 0) return {
    status: 'expired',
    label: lang === 'pt' ? 'Expirado' : lang === 'en' ? 'Expired' : 'Expirado',
    color: 'red', dotColor: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20',
  };
  if (days <= 3) return {
    status: 'expiring',
    label: lang === 'pt' ? `${days}d restantes` : lang === 'en' ? `${days}d left` : `${days}d restantes`,
    color: 'red', dotColor: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20',
  };
  if (days <= 7) return {
    status: 'warning',
    label: lang === 'pt' ? `${days}d restantes` : lang === 'en' ? `${days}d left` : `${days}d restantes`,
    color: 'amber', dotColor: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20',
  };
  return {
    status: 'active',
    label: lang === 'pt' ? `${days}d restantes` : lang === 'en' ? `${days}d left` : `${days}d restantes`,
    color: 'green', dotColor: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/20',
  };
}

interface OrderStep {
  key: string;
  label: string;
  icon: typeof DollarSign;
}

function getOrderSteps(lang: string): OrderStep[] {
  return [
    { key: 'paid', label: lang === 'pt' ? 'Pago' : lang === 'en' ? 'Paid' : 'Pagado', icon: DollarSign },
    { key: 'delivered', label: lang === 'pt' ? 'Entregue' : lang === 'en' ? 'Delivered' : 'Entregado', icon: Truck },
    { key: 'completed', label: lang === 'pt' ? 'Concluído' : lang === 'en' ? 'Completed' : 'Completado', icon: CheckCircle },
  ];
}

function getOrderStepIndex(status: string): number {
  if (['completed'].includes(status)) return 3;
  if (['delivered'].includes(status)) return 2;
  if (['paid', 'processing', 'pending'].includes(status)) return 1;
  return 0;
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
  const [purchasesPerPage] = useState(6);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedPurchaseForRating, setSelectedPurchaseForRating] = useState<UserPurchase | null>(null);
  const [userRatings, setUserRatings] = useState<Record<string, boolean>>({});
  const [renewalLoading, setRenewalLoading] = useState<string | null>(null);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [selectedPurchaseForRenewal, setSelectedPurchaseForRenewal] = useState<UserPurchase | null>(null);
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

  const stats = {
    total: purchases.length,
    active: purchases.filter(p => !isExpired(p.purchase_date) && !isCancelled(p)).length,
    expiring: purchases.filter(p => {
      const d = getDaysRemaining(p.purchase_date);
      return d > 0 && d <= 7 && !isCancelled(p);
    }).length,
    cancelled: purchases.filter(p => isCancelled(p)).length,
  };

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
      const orderIds = purchaseData
        .map(p => p.order_id)
        .filter(Boolean) as string[];
      if (orderIds.length > 0) {
        loadHelpTicketStatuses(orderIds);
      }
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

  function handleRenewPurchase(purchase: UserPurchase) {
    setSelectedPurchaseForRenewal(purchase);
    setShowRenewalModal(true);
  }

  async function processRenewal(purchase: UserPurchase) {
    if (!user) return;
    setRenewalLoading(purchase.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-purchase-renewal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify({
          purchase_id: purchase.id,
          product_id: purchase.product_id,
          product_name: purchase.product_name,
          product_price: purchase.purchase_price,
        }),
      });
      const result = await response.json();
      if (result.success) {
        alert(tr('Compra renovada com sucesso!', 'Purchase renewed successfully!', '¡Compra renovada con éxito!'));
        setShowRenewalModal(false);
        setSelectedPurchaseForRenewal(null);
        loadUserPurchases();
      } else {
        alert(result.error || tr('Erro ao renovar compra', 'Error renewing purchase', 'Error al renovar compra'));
      }
    } catch {
      alert(tr('Erro ao renovar compra', 'Error renewing purchase', 'Error al renovar compra'));
    } finally {
      setRenewalLoading(null);
    }
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

  useEffect(() => { setCurrentPage(1); }, [statusFilter, purchases.length]);

  const orderSteps = getOrderSteps(lang);

  // ─── PurchaseDetailPage redirect ───
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

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-blue-100 dark:border-gray-700" />
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin absolute inset-0" />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          {tr('Carregando suas compras...', 'Loading your purchases...', 'Cargando tus compras...')}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ─── Header ─── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-white/20">
            <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{t.myPurchases}</h1>
            <p className="text-blue-100 text-sm mt-0.5">
              {tr('Acompanhe e gerencie todas as suas compras', 'Track and manage all your purchases', 'Rastrea y gestiona todas tus compras')}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={ShoppingBag} value={stats.total} label={tr('Total', 'Total', 'Total')} color="from-blue-500 to-blue-600" />
        <StatCard icon={CheckCircle} value={stats.active} label={tr('Ativas', 'Active', 'Activas')} color="from-emerald-500 to-green-600" />
        <StatCard icon={Clock} value={stats.expiring} label={tr('Expirando', 'Expiring', 'Expirando')} color="from-amber-500 to-orange-600" />
        <StatCard icon={X} value={stats.cancelled} label={tr('Canceladas', 'Cancelled', 'Canceladas')} color="from-red-500 to-rose-600" />
      </div>

      {/* ─── Filter Tabs ─── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              statusFilter === tab.key
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              statusFilter === tab.key ? 'bg-white/25 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ─── Empty States ─── */}
      {purchases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 flex items-center justify-center">
              <Package className="w-12 h-12 text-blue-400 dark:text-blue-500" />
            </div>
            <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center animate-bounce">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{t.noPurchasesFound}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{t.noStoreOrders}</p>
        </div>
      ) : filteredPurchases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-gray-300 dark:text-gray-600" />
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {tr('Nenhuma compra encontrada', 'No purchases found', 'Ninguna compra encontrada')}
          </p>
          <p className="text-xs text-gray-400">
            {tr('Tente selecionar outro filtro', 'Try selecting another filter', 'Intenta seleccionar otro filtro')}
          </p>
        </div>
      ) : (
        <>
          {/* ─── Purchase Cards Grid ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {currentPurchases.map(purchase => {
              const cancelled = isCancelled(purchase);
              const disputed = isDisputed(purchase);
              const expired = isExpired(purchase.purchase_date);
              const expiryStatus = getExpiryStatus(purchase.purchase_date, lang);
              const stepIndex = getOrderStepIndex(purchase.store_orders?.status || '');
              const hasRating = userRatings[`${purchase.product_id}-${purchase.order_id}`] || userRatings[purchase.product_id];
              const helpStatus = helpTicketStatuses[purchase.order_id];
              const canRenew = canRenewPurchase(purchase);

              const statusBadge = cancelled
                ? { label: tr('Cancelado', 'Cancelled', 'Cancelado'), bg: 'bg-red-500', icon: X }
                : disputed
                ? { label: tr('Disputa', 'Dispute', 'Disputa'), bg: 'bg-orange-500', icon: ShieldAlert }
                : expired
                ? { label: tr('Expirado', 'Expired', 'Expirado'), bg: 'bg-gray-500', icon: AlertTriangle }
                : purchase.store_orders?.status === 'completed'
                ? { label: tr('Concluído', 'Completed', 'Completado'), bg: 'bg-green-500', icon: CheckCircle }
                : purchase.store_orders?.status === 'delivered'
                ? { label: tr('Entregue', 'Delivered', 'Entregado'), bg: 'bg-blue-500', icon: Truck }
                : { label: tr('Pago', 'Paid', 'Pagado'), bg: 'bg-cyan-500', icon: CreditCard };

              const StatusIcon = statusBadge.icon;

              return (
                <div
                  key={purchase.id}
                  className={`group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                    cancelled ? 'border-red-200 dark:border-red-900/50' : disputed ? 'border-orange-200 dark:border-orange-900/50' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {/* Image section */}
                  <div className="relative h-40 sm:h-44 overflow-hidden bg-gray-100 dark:bg-gray-700">
                    {purchase.store_products?.image_url ? (
                      <img
                        src={purchase.store_products.image_url}
                        alt={purchase.product_name}
                        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${cancelled || expired ? 'grayscale opacity-60' : ''}`}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
                        <Package className="w-12 h-12 text-white/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    {/* Status badge */}
                    <div className="absolute top-3 right-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-lg ${statusBadge.bg}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusBadge.label}
                      </span>
                    </div>
                    {/* Category badge */}
                    {purchase.store_products?.category && (
                      <div className="absolute bottom-3 left-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/40 backdrop-blur-sm text-white">
                          <Tag className="w-2.5 h-2.5" />
                          {purchase.store_products.category}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 sm:p-5 space-y-3">
                    {/* Name + variation */}
                    <div>
                      <h3 className={`font-bold text-sm sm:text-base line-clamp-1 ${
                        cancelled || expired ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-white'
                      }`}>
                        {purchase.product_name}
                      </h3>
                      {purchase.credentials?.variation_name && (
                        <div className="flex items-center gap-1 mt-1">
                          <Layers className="w-3 h-3 text-purple-400" />
                          <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                            {purchase.credentials.variation_name}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Price + Date */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-green-500" />
                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                          {formatPrice(purchase.purchase_price)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(purchase.purchase_date).toLocaleDateString(lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : 'es-ES', { day: '2-digit', month: 'short' })}
                      </div>
                    </div>

                    {/* Order Progress Tracker */}
                    {!cancelled && !disputed && (
                      <div className="flex items-center gap-1 py-1">
                        {orderSteps.map((step, i) => {
                          const isDone = i < stepIndex;
                          const isCurrent = i === stepIndex - 1;
                          const StepIcon = step.icon;
                          return (
                            <React.Fragment key={step.key}>
                              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                  isDone ? 'bg-green-500 text-white' : isCurrent ? 'bg-blue-500 text-white ring-2 ring-blue-200 dark:ring-blue-900' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                                }`}>
                                  {isDone ? <CheckCircle className="w-3.5 h-3.5" /> : <StepIcon className="w-3 h-3" />}
                                </div>
                                <span className={`text-[9px] font-medium ${isDone || isCurrent ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}`}>
                                  {step.label}
                                </span>
                              </div>
                              {i < orderSteps.length - 1 && (
                                <div className={`flex-1 h-0.5 rounded-full ${i < stepIndex - 1 ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}

                    {/* Expiry indicator */}
                    {!cancelled && !disputed && (
                      <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${expiryStatus.bgColor}`}>
                        <div className="flex items-center gap-2">
                          <Clock className={`w-4 h-4 ${expiryStatus.textColor}`} />
                          <span className={`text-xs font-medium ${expiryStatus.textColor}`}>
                            {expiryStatus.status === 'expired'
                              ? tr('Produto expirado', 'Product expired', 'Producto expirado')
                              : tr(`Validade: ${expiryStatus.label}`, `Validity: ${expiryStatus.label}`, `Validez: ${expiryStatus.label}`)}
                          </span>
                        </div>
                        {canRenew && (
                          <button
                            onClick={() => handleRenewPurchase(purchase)}
                            disabled={renewalLoading === purchase.id}
                            className="flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors disabled:opacity-50"
                          >
                            {renewalLoading === purchase.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            {tr('Renovar', 'Renew', 'Renovar')}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Disputed notice */}
                    {disputed && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 dark:bg-orange-900/20">
                        <ShieldAlert className="w-4 h-4 text-orange-500 flex-shrink-0" />
                        <span className="text-xs text-orange-700 dark:text-orange-400 font-medium">
                          {tr('Disputa em andamento', 'Dispute in progress', 'Disputa en progreso')}
                        </span>
                      </div>
                    )}

                    {/* Cancelled notice */}
                    {cancelled && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20">
                        <X className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <span className="text-xs text-red-700 dark:text-red-400 font-medium">
                          {tr('Compra cancelada e reembolsada', 'Purchase cancelled and refunded', 'Compra cancelada y reembolsada')}
                        </span>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <button
                        onClick={() => handleViewDetails(purchase)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                          cancelled
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                            : expired
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow'
                        }`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {tr('Ver Detalhes', 'View Details', 'Ver Detalles')}
                      </button>

                      {!cancelled && !expired && (
                        <button
                          onClick={() => handleRateProduct(purchase)}
                          disabled={hasRating}
                          className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                            hasRating
                              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 cursor-default'
                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                          }`}
                          title={hasRating ? tr('Avaliado', 'Rated', 'Calificado') : tr('Avaliar produto', 'Rate product', 'Calificar producto')}
                        >
                          <Star className={`w-3.5 h-3.5 ${hasRating ? 'fill-current' : ''}`} />
                        </button>
                      )}

                      <button
                        onClick={() => handleHelpClick(purchase)}
                        className={`flex items-center justify-center px-3 py-2 rounded-xl text-xs font-semibold transition-all relative ${
                          helpStatus?.escalated
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                            : helpStatus?.status === 'resolved'
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                            : helpStatus
                            ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                        title={tr('Ajuda', 'Help', 'Ayuda')}
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        {helpStatus && !helpStatus.escalated && helpStatus.status !== 'resolved' && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── Pagination ─── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
                      className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${
                        currentPage === page
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
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
                className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ─── Modals ─── */}
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

      {showRenewalModal && selectedPurchaseForRenewal && (
        <RenewalConfirmationModal
          isOpen={showRenewalModal}
          onClose={() => { setShowRenewalModal(false); setSelectedPurchaseForRenewal(null); }}
          purchase={selectedPurchaseForRenewal}
          onConfirm={() => processRenewal(selectedPurchaseForRenewal)}
          isProcessing={renewalLoading === selectedPurchaseForRenewal.id}
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

// ─── Stat Card Component ───
function StatCard({ icon: Icon, value, label, color }: {
  icon: React.ElementType;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 transition-all hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Renewal Confirmation Modal ───
interface RenewalConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: UserPurchase;
  onConfirm: () => void;
  isProcessing: boolean;
}

function RenewalConfirmationModal({ isOpen, onClose, purchase, onConfirm, isProcessing }: RenewalConfirmationModalProps) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const lang = t.language;
  const tr = (pt: string, en: string, es: string) => lang === 'pt' ? pt : lang === 'en' ? en : es;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <RefreshCw className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold">
                {tr('Renovar Compra', 'Renew Purchase', 'Renovar Compra')}
              </h2>
            </div>
            <button onClick={onClose} disabled={isProcessing} className="p-1 rounded-lg hover:bg-white/20 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {tr(
                `Deseja renovar sua compra de ${purchase.product_name}?`,
                `Do you want to renew your purchase of ${purchase.product_name}?`,
                `¿Desea renovar su compra de ${purchase.product_name}?`
              )}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {tr(
                `Será cobrado ${formatPrice(purchase.purchase_price)} por mais 30 dias.`,
                `You will be charged ${formatPrice(purchase.purchase_price)} for 30 more days.`,
                `Se le cobrará ${formatPrice(purchase.purchase_price)} por 30 días más.`
              )}
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">{tr('Produto:', 'Product:', 'Producto:')}</span>
              <span className="font-medium text-gray-900 dark:text-white truncate ml-2">{purchase.product_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">{tr('Duração:', 'Duration:', 'Duración:')}</span>
              <span className="font-medium text-gray-900 dark:text-white">{tr('30 dias', '30 days', '30 días')}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-600">
              <span className="text-gray-500 dark:text-gray-400">{tr('Valor:', 'Amount:', 'Valor:')}</span>
              <span className="font-bold text-gray-900 dark:text-white">{formatPrice(purchase.purchase_price)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {tr('Não', 'No', 'No')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {tr('Renovando...', 'Renewing...', 'Renovando...')}
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                {tr('Sim, Renovar', 'Yes, Renew', 'Sí, Renovar')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
