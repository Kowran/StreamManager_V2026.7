import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Package, CreditCard, Copy, Check,
  Clock, AlertTriangle, CheckCircle, XCircle, Truck, ShoppingBag,
  ChevronRight, Star, RefreshCw, HelpCircle, Shield, ShieldAlert, ExternalLink,
  DollarSign, Tag, Zap, CheckCheck, MessageCircle, Layers, Store, User,
  Calendar, FileText, MessageSquare
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { ChatModal } from './ChatModal';

interface PurchaseDetailProps {
  purchaseId: string;
  onBack: () => void;
}

interface FullPurchase {
  id: string;
  user_id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  purchase_price: number;
  credentials: any;
  purchase_date: string;
  expires_at?: string;
  read_accounts?: number[];
  store_products?: {
    image_url?: string;
    category: string;
    description?: string;
    name: string;
    price_usdt: number;
    seller_id?: string;
  };
  store_orders?: {
    id: string;
    status: string;
    created_at: string;
    updated_at?: string;
    cancelled_at?: string;
    cancellation_reason?: string;
    discount_amount?: number;
    cashback_used?: number;
    coupon_id?: string;
    customer_email?: string;
    customer_name?: string;
    total_usdt?: number;
    seller_id?: string;
    dispute_opened_at?: string;
    delivered_at?: string;
  };
}

interface SellerProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  seller_slug?: string;
  theme_color?: string;
  username?: string | null;
}

function calculateExpiryDate(purchaseDate: string): Date {
  const purchase = new Date(purchaseDate);
  return new Date(purchase.getTime() + 30 * 24 * 60 * 60 * 1000);
}

function getDaysRemaining(purchaseDate: string): number {
  const expiryDate = calculateExpiryDate(purchaseDate);
  const now = new Date();
  return Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function PurchaseDetailPage({ purchaseId, onBack }: PurchaseDetailProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [purchase, setPurchase] = useState<FullPurchase | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [expandedAccounts, setExpandedAccounts] = useState<number[]>([]);
  const [userRated, setUserRated] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [disputeTicket, setDisputeTicket] = useState<any | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const lang = (t as any).language || 'pt';
  const lbl = useCallback((pt: string, en: string, es: string) =>
    lang === 'pt' ? pt : lang === 'en' ? en : es, [lang]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(
    lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : 'es-ES',
    { day: '2-digit', month: 'short', year: 'numeric' }
  );
  const fmtDateTime = (d: string) => new Date(d).toLocaleString(
    lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : 'es-ES'
  );

  useEffect(() => { loadPurchase(); }, [purchaseId]);

  async function loadPurchase() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_purchases')
        .select(`
          *,
          store_products!user_purchases_product_id_fkey (
            image_url, category, description, name, price_usdt, seller_id
          ),
          store_orders!user_purchases_order_id_fkey (
            id, status, created_at, updated_at,
            cancelled_at, cancellation_reason, discount_amount, cashback_used,
            coupon_id, customer_email, customer_name, total_usdt, seller_id, dispute_opened_at, delivered_at
          )
        `)
        .eq('id', purchaseId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) { onBack(); return; }

      setPurchase(data as FullPurchase);

      const sellerId = (data.store_orders as any)?.seller_id || (data.store_products as any)?.seller_id;
      if (sellerId) {
        const { data: sellerData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, seller_slug, theme_color, username')
          .eq('id', sellerId)
          .maybeSingle();
        if (sellerData) setSeller(sellerData);
      }

      const ratedOrderId = (data.store_orders as any)?.id;
      const { data: rating } = await supabase
        .from('product_ratings')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', data.product_id)
        .eq('order_id', ratedOrderId)
        .maybeSingle();
      setUserRated(!!rating);

      const orderId = (data.store_orders as any)?.id;
      if (orderId) {
        const { data: ticketData } = await supabase
          .from('seller_support_tickets')
          .select('id, ticket_number, subject, status, escalated, admin_resolved, resolution_type, resolution_notes, resolved_at')
          .eq('order_id', orderId)
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setDisputeTicket(ticketData);
      }
    } catch (err) {
      console.error('Error loading purchase:', err);
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    } catch { /* ignore */ }
  }

  async function confirmDelivery() {
    if (!purchase?.store_orders?.id) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const { data, error } = await supabase.rpc('confirm_customer_delivery', {
        p_order_id: purchase.store_orders.id,
      });
      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || 'Failed to confirm delivery');
      }
      await loadPurchase();
    } catch (err: any) {
      setConfirmError(err.message || 'Error confirming delivery');
    } finally {
      setConfirming(false);
    }
  }

  function getTestPeriodDaysRemaining(): number {
    const order = purchase?.store_orders;
    if (!order?.created_at) return 0;
    const purchaseDate = new Date(order.created_at);
    const testEnd = new Date(purchaseDate.getTime() + 3 * 24 * 60 * 60 * 1000);
    const diff = testEnd.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  function toggleAccount(idx: number) {
    setExpandedAccounts(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
    if (purchase && !(purchase.read_accounts || []).includes(idx)) {
      const newRead = [...(purchase.read_accounts || []), idx];
      supabase.from('user_purchases').update({ read_accounts: newRead }).eq('id', purchase.id);
      setPurchase(prev => prev ? { ...prev, read_accounts: newRead } : prev);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!purchase) return null;

  const order = purchase.store_orders as any;
  const isCancelled = order?.status === 'cancelled';
  const isDisputed = order?.status === 'disputed';
  const isCompleted = order?.status === 'completed';
  const isDelivered = order?.status === 'delivered';
  const isPaid = ['paid', 'delivered', 'completed', 'disputed'].includes(order?.status || '');
  const daysRemaining = getDaysRemaining(purchase.purchase_date);
  const isExpired = daysRemaining <= 0;
  const expiryDate = calculateExpiryDate(purchase.purchase_date);
  const accounts = purchase.credentials?.accounts;
  const isMultiAccount = Array.isArray(accounts) && accounts.length > 0;
  const description = purchase.store_products?.description || '';
  const isLongDescription = description.length > 180;

  const statusConfig = isCancelled
    ? { label: lbl('Cancelado', 'Cancelled', 'Cancelado'), color: 'red', icon: XCircle, bg: 'bg-red-50 dark:bg-red-900/10', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800' }
    : isDisputed
    ? { label: lbl('Em Disputa', 'In Dispute', 'En Disputa'), color: 'orange', icon: AlertTriangle, bg: 'bg-orange-50 dark:bg-orange-900/10', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' }
    : isExpired
    ? { label: lbl('Expirado', 'Expired', 'Expirado'), color: 'red', icon: AlertTriangle, bg: 'bg-red-50 dark:bg-red-900/10', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800' }
    : isCompleted
    ? { label: lbl('Finalizado', 'Completed', 'Finalizado'), color: 'green', icon: CheckCircle, bg: 'bg-green-50 dark:bg-green-900/10', text: 'text-green-700 dark:text-green-400', border: 'border-green-200 dark:border-green-800' }
    : isDelivered
    ? { label: lbl('Entregue', 'Delivered', 'Entregado'), color: 'blue', icon: Truck, bg: 'bg-blue-50 dark:bg-blue-900/10', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' }
    : { label: lbl('Em andamento', 'In Progress', 'En progreso'), color: 'blue', icon: Clock, bg: 'bg-blue-50 dark:bg-blue-900/10', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' };

  const StatusIcon = statusConfig.icon;

  const steps = [
    { key: 'paid', label: lbl('Pagamento', 'Payment', 'Pago'), done: isPaid || isCompleted || isDelivered, date: order?.created_at, icon: DollarSign },
    { key: 'delivered', label: lbl('Entrega', 'Delivery', 'Entrega'), done: isCompleted || isDelivered, date: isDelivered || isCompleted ? order?.updated_at : null, icon: Truck },
    { key: 'completed', label: lbl('Finalizado', 'Completed', 'Finalizado'), done: isCompleted, date: isCompleted ? order?.updated_at : null, icon: CheckCircle },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5 pb-10">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {lbl('Minhas Compras', 'My Purchases', 'Mis Compras')}
      </button>

      {/* ====== HERO: Product + Status ====== */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            {/* Image */}
            <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 flex-shrink-0">
              {purchase.store_products?.image_url ? (
                <img src={purchase.store_products.image_url} alt={purchase.product_name}
                  className={`w-full h-full object-cover ${isCancelled || isExpired ? 'grayscale opacity-60' : ''}`} />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                  <Package className="h-10 w-10 text-white" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 w-full">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white leading-tight break-words">
                    {purchase.product_name}
                  </h1>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {purchase.credentials?.variation_name && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        <Layers className="h-3 w-3" />
                        {purchase.credentials.variation_name}
                      </span>
                    )}
                    {purchase.store_products?.category && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                        <Tag className="h-3 w-3 mr-1" />
                        {purchase.store_products.category}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400 flex-shrink-0">
                  {formatPrice(purchase.purchase_price)}
                </span>
              </div>

              {/* Description - contained with scroll */}
              {description && (
                <div className="mt-3 relative">
                  <div className={`text-sm text-gray-500 dark:text-gray-400 leading-relaxed overflow-hidden transition-all ${
                    showFullDescription ? 'max-h-40 overflow-y-auto' : isLongDescription ? 'max-h-20' : ''
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{description}</p>
                  </div>
                  {isLongDescription && !showFullDescription && (
                    <button
                      onClick={() => setShowFullDescription(true)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium mt-1"
                    >
                      {lbl('Ver mais', 'Show more', 'Ver más')}
                    </button>
                  )}
                  {showFullDescription && (
                    <button
                      onClick={() => setShowFullDescription(false)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium mt-1"
                    >
                      {lbl('Ver menos', 'Show less', 'Ver menos')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className={`px-5 sm:px-6 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 ${statusConfig.bg}`}>
          <StatusIcon className={`h-4 w-4 ${statusConfig.text.replace('text-', 'text-').replace('dark:text-', '')}`} />
          <span className={`text-sm font-semibold ${statusConfig.text}`}>
            {statusConfig.label}
          </span>
          {!isCancelled && !isExpired && !isCompleted && (
            <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
              {daysRemaining > 0
                ? lbl(`${daysRemaining} dias restantes`, `${daysRemaining} days left`, `${daysRemaining} días restantes`)
                : lbl('Expirado', 'Expired', 'Expirado')}
            </span>
          )}
        </div>
      </div>

      {/* ====== Progress Tracker ====== */}
      {!isCancelled && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-500" />
            {lbl('Progresso da Compra', 'Purchase Progress', 'Progreso de Compra')}
          </h2>
          <div className="flex items-start gap-0">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isLast = idx === steps.length - 1;
              return (
                <div key={step.key} className="flex-1 flex flex-col items-center relative">
                  {!isLast && (
                    <div className={`absolute top-5 left-1/2 right-0 h-0.5 z-0 ${
                      step.done && steps[idx + 1]?.done
                        ? 'bg-green-400 dark:bg-green-500'
                        : step.done
                        ? 'bg-gradient-to-r from-green-400 to-gray-200 dark:from-green-500 dark:to-gray-600'
                        : 'bg-gray-200 dark:bg-gray-600'
                    }`} />
                  )}
                  <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    step.done
                      ? 'bg-green-500 border-green-500 text-white shadow-md shadow-green-200 dark:shadow-green-900'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'
                  }`}>
                    {step.done ? <Check className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <p className={`mt-2 text-xs font-medium text-center ${step.done ? 'text-green-700 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    {step.label}
                  </p>
                  {step.done && step.date && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-0.5">
                      {fmtDate(step.date)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ====== Two-column layout: left = credentials, right = info ====== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT: Credentials (2 cols) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Test Period & Confirmation */}
          {!isCancelled && !isCompleted && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-sm p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                    {lbl('Período de Teste (3 dias)', 'Test Period (3 days)', 'Período de Prueba (3 días)')}
                  </h3>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-1 leading-relaxed">
                    {lbl(
                      'Você tem 3 dias para testar o produto. Confirme o recebimento das contas para finalizar o pedido.',
                      'You have 3 days to test the product. Confirm account delivery to finalize the order.',
                      'Tienes 3 días para probar el producto. Confirma la entrega de cuentas para finalizar el pedido.'
                    )}
                  </p>
                  {(() => {
                    const daysLeft = getTestPeriodDaysRemaining();
                    return (
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700">
                        <Clock className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                          {daysLeft > 0
                            ? lbl(`${daysLeft} dia${daysLeft > 1 ? 's' : ''} restante${daysLeft > 1 ? 's' : ''}`, `${daysLeft} day${daysLeft > 1 ? 's' : ''} remaining`, `${daysLeft} día${daysLeft > 1 ? 's' : ''} restante${daysLeft > 1 ? 's' : ''}`)
                            : lbl('Período encerrado', 'Period ended', 'Período terminado')}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {confirmError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <span className="text-xs text-red-700 dark:text-red-400">{confirmError}</span>
                </div>
              )}

              <button
                onClick={confirmDelivery}
                disabled={confirming}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {confirming ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    {lbl('Confirmando...', 'Confirming...', 'Confirmando...')}
                  </>
                ) : (
                  <>
                    <CheckCheck className="h-5 w-5" />
                    {lbl('Confirmar Recebimento das Contas', 'Confirm Account Delivery', 'Confirmar Recepción de Cuentas')}
                  </>
                )}
              </button>
              <p className="text-xs text-blue-600 dark:text-blue-400 text-center leading-relaxed">
                {lbl(
                  'Ao confirmar, o pedido será finalizado. O saldo do vendedor será liberado após 3 dias da compra.',
                  'By confirming, the order will be finalized. The seller balance will be released 3 days after purchase.',
                  'Al confirmar, el pedido será finalizado. El saldo del vendedor se liberará 3 días después de la compra.'
                )}
              </p>
            </div>
          )}

          {/* Delivery Confirmed */}
          {!isCancelled && isCompleted && order?.delivered_at && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200 dark:border-green-800 shadow-sm p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                  {lbl('Recebimento Confirmado', 'Delivery Confirmed', 'Recepción Confirmada')}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {lbl('Confirmado em', 'Confirmed on', 'Confirmado el')} {fmtDateTime(order.delivered_at)}
                </p>
              </div>
            </div>
          )}

          {/* Credentials */}
          {!isCancelled && (
            <div className={`bg-white dark:bg-gray-800 rounded-2xl border shadow-sm overflow-hidden ${
              isExpired ? 'border-red-200 dark:border-red-700' : 'border-green-200 dark:border-green-700'
            }`}>
              <div className={`px-5 py-4 border-b ${
                isExpired ? 'border-red-100 dark:border-red-800 bg-red-50 dark:bg-red-900/10' :
                'border-green-100 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
              }`}>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <CreditCard className={`h-4 w-4 ${isExpired ? 'text-red-500' : 'text-green-600'}`} />
                  {lbl('Credenciais de Acesso', 'Access Credentials', 'Credenciales de Acceso')}
                  {isMultiAccount && (
                    <span className="text-xs font-normal text-gray-500 ml-1">
                      ({accounts.length} {lbl('contas', 'accounts', 'cuentas')})
                    </span>
                  )}
                </h2>
                {isExpired && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {lbl('Este produto expirou. As credenciais podem não funcionar.', 'This product expired. Credentials may not work.', 'Este producto expiró. Las credenciales pueden no funcionar.')}
                  </p>
                )}
              </div>

              <div className="p-5">
                {isMultiAccount ? (
                  <div className="space-y-2">
                    {accounts.map((acct: any, idx: number) => {
                      const expanded = expandedAccounts.includes(idx);
                      const wasRead = (purchase.read_accounts || []).includes(idx) || expandedAccounts.includes(idx);
                      return (
                        <div key={idx} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <button
                            onClick={() => toggleAccount(idx)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors bg-white dark:bg-gray-800"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`} />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                                {lbl('Conta', 'Account', 'Cuenta')} #{idx + 1}
                              </span>
                              {acct.profile_number && (
                                <span className="text-xs text-gray-400 truncate">— {lbl('Perfil', 'Profile', 'Perfil')} {acct.profile_number}</span>
                              )}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                              wasRead
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                              {wasRead ? lbl('Lida', 'Read', 'Leída') : lbl('Nova', 'New', 'Nueva')}
                            </span>
                          </button>
                          {expanded && (
                            <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                              <CredentialRow label={lbl('Email', 'Email', 'Email')} value={acct.email} onCopy={copyToClipboard} copiedText={copiedText} />
                              <CredentialRow label={lbl('Senha', 'Password', 'Contraseña')} value={acct.password} onCopy={copyToClipboard} copiedText={copiedText} />
                              {acct.pin && <CredentialRow label="PIN" value={acct.pin} onCopy={copyToClipboard} copiedText={copiedText} />}
                              {acct.instructions && (
                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{lbl('Instruções:', 'Instructions:', 'Instrucciones:')}</p>
                                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                                    {acct.instructions}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-700/30 p-4 space-y-3">
                    {purchase.credentials?.email && (
                      <CredentialRow label={lbl('Email', 'Email', 'Email')} value={purchase.credentials.email} onCopy={copyToClipboard} copiedText={copiedText} />
                    )}
                    {purchase.credentials?.password && (
                      <CredentialRow label={lbl('Senha', 'Password', 'Contraseña')} value={purchase.credentials.password} onCopy={copyToClipboard} copiedText={copiedText} />
                    )}
                    {purchase.credentials?.pin && (
                      <CredentialRow label="PIN" value={purchase.credentials.pin} onCopy={copyToClipboard} copiedText={copiedText} />
                    )}
                    {purchase.credentials?.instructions && (
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{lbl('Instruções:', 'Instructions:', 'Instrucciones:')}</p>
                        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                          {purchase.credentials.instructions}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dispute Notice */}
          {isDisputed && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <span className="font-semibold text-orange-800 dark:text-orange-300">
                  {lbl('Disputa Aberta', 'Dispute Open', 'Disputa Abierta')}
                </span>
              </div>
              <p className="text-sm text-orange-700 dark:text-orange-400 leading-relaxed">
                {lbl('Você abriu uma disputa para esta compra. O vendedor e o suporte estão cientes.', 'You opened a dispute for this purchase. The seller and support are aware.', 'Abriste una disputa para esta compra. El vendedor y soporte están al tanto.')}
              </p>
              {order?.dispute_opened_at && (
                <p className="text-xs text-orange-500 dark:text-orange-500 mt-1">
                  {lbl('Aberto em', 'Opened on', 'Abierto el')}: {fmtDateTime(order.dispute_opened_at)}
                </p>
              )}
            </div>
          )}

          {/* Dispute Resolution */}
          {disputeTicket?.admin_resolved && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                  {lbl('Disputa Resolvida pela Administração', 'Dispute Resolved by Admin', 'Disputa Resuelta por la Administración')}
                </span>
              </div>
              <p className="text-sm text-emerald-700 dark:text-emerald-400 mb-2 leading-relaxed">
                {lbl('A administração analisou sua disputa e tomou a seguinte decisão:', 'The administration analyzed your dispute and made the following decision:', 'La administración analizó tu disputa y tomó la siguiente decisión:')}
              </p>
              <div className="font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                {disputeTicket.resolution_type === 'refund'
                  ? lbl('Reembolso ao cliente', 'Refund to customer', 'Reembolso al cliente')
                  : disputeTicket.resolution_type === 'replace_account'
                  ? lbl('Substituição de produto', 'Product replacement', 'Reemplazo de producto')
                  : lbl('Disputa encerrada', 'Dispute closed', 'Disputa cerrada')}
              </div>
              {disputeTicket.resolution_notes && (
                <div className="text-sm text-emerald-700 dark:text-emerald-400 bg-white/60 dark:bg-gray-800/40 rounded-lg p-3 mb-2 max-h-40 overflow-y-auto">
                  <div className="font-medium mb-1">{lbl('Notas do administrador:', 'Admin notes:', 'Notas del administrador:')}</div>
                  <p className="whitespace-pre-wrap break-words">{disputeTicket.resolution_notes}</p>
                </div>
              )}
              {disputeTicket.resolved_at && (
                <p className="text-xs text-emerald-500 dark:text-emerald-500">
                  {lbl('Resolvido em', 'Resolved on', 'Resuelto el')}: {fmtDateTime(disputeTicket.resolved_at)}
                </p>
              )}
            </div>
          )}

          {/* Cancellation */}
          {isCancelled && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="font-semibold text-red-800 dark:text-red-300">
                  {lbl('Compra Cancelada', 'Purchase Cancelled', 'Compra Cancelada')}
                </span>
              </div>
              <p className="text-sm text-red-700 dark:text-red-400 leading-relaxed">
                {lbl('Esta compra foi cancelada e você foi reembolsado automaticamente.', 'This purchase was cancelled and you were automatically refunded.', 'Esta compra fue cancelada y fuiste reembolsado automáticamente.')}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: Order info + Seller (1 col) */}
        <div className="space-y-5">
          {/* Order Details */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-gray-500" />
              {lbl('Detalhes do Pedido', 'Order Details', 'Detalles del Pedido')}
            </h2>
            <div className="space-y-3 text-sm">
              <InfoRow icon={FileText} label={lbl('ID do Pedido', 'Order ID', 'ID del Pedido')}>
                <p className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate">{order?.id || '—'}</p>
              </InfoRow>
              <InfoRow icon={Calendar} label={lbl('Data da Compra', 'Purchase Date', 'Fecha de Compra')}>
                <p className="text-gray-900 dark:text-white font-medium">{fmtDate(purchase.purchase_date)}</p>
              </InfoRow>
              <InfoRow icon={DollarSign} label={lbl('Valor Pago', 'Amount Paid', 'Monto Pagado')}>
                <p className="font-bold text-green-600 dark:text-green-400">{formatPrice(purchase.purchase_price)}</p>
              </InfoRow>
              {order?.discount_amount > 0 && (
                <InfoRow icon={Tag} label={lbl('Desconto Cupom', 'Coupon Discount', 'Descuento Cupón')}>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">-{formatPrice(order.discount_amount)}</p>
                </InfoRow>
              )}
              {order?.cashback_used > 0 && (
                <InfoRow icon={Zap} label={lbl('Cashback Usado', 'Cashback Used', 'Cashback Usado')}>
                  <p className="font-semibold text-amber-600 dark:text-amber-400">-{formatPrice(order.cashback_used)}</p>
                </InfoRow>
              )}
              <InfoRow icon={Clock} label={lbl('Expiração', 'Expiry', 'Expiración')}>
                <p className="text-gray-900 dark:text-white">{fmtDate(expiryDate.toISOString())}</p>
              </InfoRow>
            </div>
            {isCancelled && order?.cancellation_reason && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">{lbl('Motivo do Cancelamento', 'Cancellation Reason', 'Motivo de Cancelación')}</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1 break-words">{order.cancellation_reason}</p>
              </div>
            )}
          </div>

          {/* Seller Info */}
          {seller && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Store className="h-4 w-4 text-gray-500" />
                {lbl('Vendedor', 'Seller', 'Vendedor')}
              </h2>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full overflow-hidden border-2 flex-shrink-0"
                  style={{ borderColor: seller.theme_color || '#3b82f6' }}>
                  {seller.avatar_url ? (
                    <img src={seller.avatar_url} alt={seller.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-lg font-bold"
                      style={{ background: seller.theme_color || '#3b82f6' }}>
                      {seller.full_name?.[0]?.toUpperCase() || 'S'}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => {
                      const ident = seller.username || seller.id;
                      if (ident) { window.history.pushState(null, '', `/user/${ident}`); window.dispatchEvent(new PopStateEvent('popstate')); }
                    }}
                    className="font-semibold text-gray-900 dark:text-white hover:underline text-left text-sm truncate block"
                  >
                    {seller.full_name}
                  </button>
                  {seller.seller_slug && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{seller.seller_slug}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => setShowChat(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  {lbl('Conversar com vendedor', 'Chat with seller', 'Chatear con vendedor')}
                </button>
                {seller.seller_slug && (
                  <a href={`/seller/${seller.seller_slug}`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <ExternalLink className="h-4 w-4" />
                    {lbl('Ver loja', 'View store', 'Ver tienda')}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Communication Notice */}
          {seller && !isCancelled && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 shadow-sm p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    {lbl('Comunicação apenas pela plataforma', 'Platform-only communication', 'Comunicación solo por la plataforma')}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                    {lbl(
                      'Todo contato com o vendedor deve ser feito exclusivamente pelo chat do site. Não compartilhe nem aceite contatos externos.',
                      'All contact with the seller must be done exclusively through the site chat. Do not share or accept external contacts.',
                      'Todo contacto con el vendedor debe hacerse exclusivamente por el chat del sitio. No compartas ni aceptes contactos externos.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Rating Badge */}
          {!isCancelled && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 flex items-center justify-center gap-2">
              {userRated ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 font-medium">
                  <Star className="h-4 w-4 fill-current" />
                  {lbl('Produto avaliado por você', 'You rated this product', 'Calificaste este producto')}
                </span>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500 text-center">
                  {lbl('Você ainda não avaliou este produto', 'You haven\'t rated this product yet', 'Aún no calificaste este producto')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {showChat && seller && order && (
        <ChatModal
          otherUserId={seller.id}
          onClose={() => setShowChat(false)}
          orderContext={{
            orderId: order.id,
            productName: purchase?.product_name || lbl('Produto', 'Product', 'Producto'),
            productImage: purchase?.store_products?.image_url || undefined,
            quantity: 1,
            totalUsdt: order.total_usdt || 0,
            customerName: order.customer_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '',
          }}
        />
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        {children}
      </div>
    </div>
  );
}

function CredentialRow({
  label, value, onCopy, copiedText
}: { label: string; value: string; onCopy: (v: string) => void; copiedText: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
        <p className="font-mono text-sm text-gray-900 dark:text-white break-all">{value}</p>
      </div>
      <button
        onClick={() => onCopy(value)}
        className="flex-shrink-0 p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        title="Copiar"
      >
        {copiedText === value
          ? <Check className="h-4 w-4 text-green-500" />
          : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
