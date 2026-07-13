import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Package, CreditCard, Calendar, User, Store, Copy, Check,
  Clock, AlertTriangle, CheckCircle, XCircle, Truck, ShoppingBag,
  ChevronRight, Star, RefreshCw, HelpCircle, Shield, ExternalLink,
  DollarSign, Tag, Zap, Phone, MessageCircle, CheckCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';

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
    customer_contact?: string;
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
  phone_number?: string;
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

  const lang = (t as any).language || 'pt';
  const lbl = useCallback((pt: string, en: string, es: string) =>
    lang === 'pt' ? pt : lang === 'en' ? en : es, [lang]);

  useEffect(() => {
    loadPurchase();
  }, [purchaseId]);

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
            coupon_id, customer_email, customer_name, customer_contact, total_usdt, seller_id, dispute_opened_at, delivered_at
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
          .select('id, full_name, avatar_url, seller_slug, theme_color, phone_number')
          .eq('id', sellerId)
          .maybeSingle();
        if (sellerData) setSeller(sellerData);
      }

      // Check if user rated this product
      const { data: rating } = await supabase
        .from('product_ratings')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', data.product_id)
        .maybeSingle();
      setUserRated(!!rating);
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
      // Refresh purchase data
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
    // Mark as read
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

  // Progress steps based on order status
  const steps = [
    {
      key: 'paid',
      label: lbl('Pagamento', 'Payment', 'Pago'),
      done: isPaid || isCompleted || isDelivered,
      date: order?.created_at,
      icon: DollarSign,
    },
    {
      key: 'delivered',
      label: lbl('Entrega', 'Delivery', 'Entrega'),
      done: isCompleted || isDelivered,
      date: isDelivered || isCompleted ? order?.updated_at : null,
      icon: Truck,
    },
    {
      key: 'completed',
      label: lbl('Finalizado', 'Completed', 'Finalizado'),
      done: isCompleted,
      date: isCompleted ? order?.updated_at : null,
      icon: CheckCircle,
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-8">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {lbl('Minhas Compras', 'My Purchases', 'Mis Compras')}
      </button>

      {/* Product Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="h-20 w-20 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 flex-shrink-0">
              {purchase.store_products?.image_url ? (
                <img src={purchase.store_products.image_url} alt={purchase.product_name}
                  className={`w-full h-full object-cover ${isCancelled || isExpired ? 'grayscale opacity-60' : ''}`} />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                  <Package className="h-8 w-8 text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                    {purchase.product_name}
                  </h1>
                  {purchase.store_products?.category && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 mt-1">
                      <Tag className="h-3 w-3 mr-1" />
                      {purchase.store_products.category}
                    </span>
                  )}
                </div>
                <span className="text-xl font-bold text-green-600 dark:text-green-400 flex-shrink-0">
                  {formatPrice(purchase.purchase_price)}
                </span>
              </div>
              {purchase.store_products?.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                  {purchase.store_products.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className={`px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 ${
          isCancelled ? 'bg-red-50 dark:bg-red-900/10' :
          isDisputed ? 'bg-orange-50 dark:bg-orange-900/10' :
          isExpired ? 'bg-red-50 dark:bg-red-900/10' :
          isCompleted ? 'bg-green-50 dark:bg-green-900/10' :
          'bg-blue-50 dark:bg-blue-900/10'
        }`}>
          {isCancelled ? <XCircle className="h-4 w-4 text-red-500" /> :
           isDisputed ? <AlertTriangle className="h-4 w-4 text-orange-500" /> :
           isExpired ? <AlertTriangle className="h-4 w-4 text-red-500" /> :
           isCompleted ? <CheckCircle className="h-4 w-4 text-green-500" /> :
           <Clock className="h-4 w-4 text-blue-500" />}
          <span className={`text-sm font-semibold ${
            isCancelled ? 'text-red-700 dark:text-red-400' :
            isDisputed ? 'text-orange-700 dark:text-orange-400' :
            isExpired ? 'text-red-700 dark:text-red-400' :
            isCompleted ? 'text-green-700 dark:text-green-400' :
            'text-blue-700 dark:text-blue-400'
          }`}>
            {isCancelled ? lbl('Cancelado', 'Cancelled', 'Cancelado') :
             isDisputed ? lbl('Em Disputa', 'In Dispute', 'En Disputa') :
             isExpired ? lbl('Expirado', 'Expired', 'Expirado') :
             isCompleted ? lbl('Finalizado', 'Completed', 'Finalizado') :
             isDelivered ? lbl('Entregue', 'Delivered', 'Entregado') :
             lbl('Em andamento', 'In Progress', 'En progreso')}
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

      {/* Sale Progress Tracker */}
      {!isCancelled && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
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
                  {/* Connector line */}
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
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-0.5">
                      {new Date(step.date).toLocaleDateString(lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : 'es-ES', {
                        day: '2-digit', month: '2-digit',
                      })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3-Day Test Period & Delivery Confirmation */}
      {!isCancelled && !isCompleted && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                {lbl('Período de Teste (3 dias)', 'Test Period (3 days)', 'Período de Prueba (3 días)')}
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
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
          <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
            {lbl(
              'Ao confirmar, o pedido será finalizado. O saldo do vendedor será liberado após 3 dias da compra.',
              'By confirming, the order will be finalized. The seller balance will be released 3 days after purchase.',
              'Al confirmar, el pedido será finalizado. El saldo del vendedor se liberará 3 días después de la compra.'
            )}
          </p>
        </div>
      )}

      {/* Delivery Confirmed Info */}
      {!isCancelled && isCompleted && order?.delivered_at && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 shadow-sm p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">
              {lbl('Recebimento Confirmado', 'Delivery Confirmed', 'Recepción Confirmada')}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              {lbl('Confirmado em', 'Confirmed on', 'Confirmado el')} {new Date(order.delivered_at).toLocaleString(lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : 'es-ES')}
            </p>
          </div>
        </div>
      )}

      {/* Seller Contact */}
      {seller && (seller.phone_number || order?.customer_contact) && !isCancelled && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Phone className="h-4 w-4 text-gray-500" />
            {lbl('Contato do Vendedor', 'Seller Contact', 'Contacto del Vendedor')}
          </h2>
          <div className="space-y-2">
            {seller.phone_number && (
              <a
                href={`https://wa.me/${seller.phone_number.replace(/\\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">{seller.phone_number}</p>
                    <p className="text-xs text-green-600 dark:text-green-400">{lbl('WhatsApp do Vendedor', 'Seller WhatsApp', 'WhatsApp del Vendedor')}</p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-green-500" />
              </a>
            )}
            {order?.customer_contact && !seller.phone_number && (
              <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{order.customer_contact}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{lbl('Seu Contato', 'Your Contact', 'Tu Contacto')}</p>
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(order.customer_contact!)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {copiedText === order.customer_contact ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-gray-500" />
          {lbl('Detalhes do Pedido', 'Order Details', 'Detalles del Pedido')}
        </h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{lbl('ID do Pedido', 'Order ID', 'ID del Pedido')}</p>
            <p className="font-mono text-xs text-gray-700 dark:text-gray-300 mt-0.5 truncate">{order?.id || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{lbl('Data da Compra', 'Purchase Date', 'Fecha de Compra')}</p>
            <p className="text-gray-900 dark:text-white font-medium mt-0.5">
              {new Date(purchase.purchase_date).toLocaleDateString(lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : 'es-ES')}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{lbl('Valor Pago', 'Amount Paid', 'Monto Pagado')}</p>
            <p className="font-bold text-green-600 dark:text-green-400 mt-0.5">{formatPrice(purchase.purchase_price)}</p>
          </div>
          {order?.discount_amount > 0 && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{lbl('Desconto Cupom', 'Coupon Discount', 'Descuento Cupón')}</p>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">-{formatPrice(order.discount_amount)}</p>
            </div>
          )}
          {order?.cashback_used > 0 && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{lbl('Cashback Usado', 'Cashback Used', 'Cashback Usado')}</p>
              <p className="font-semibold text-amber-600 dark:text-amber-400 mt-0.5">-{formatPrice(order.cashback_used)}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{lbl('Expiração', 'Expiry', 'Expiración')}</p>
            <p className="text-gray-900 dark:text-white mt-0.5">
              {expiryDate.toLocaleDateString(lang === 'pt' ? 'pt-BR' : lang === 'en' ? 'en-US' : 'es-ES')}
            </p>
          </div>
        </div>
        {isCancelled && order?.cancellation_reason && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">{lbl('Motivo do Cancelamento', 'Cancellation Reason', 'Motivo de Cancelación')}</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{order.cancellation_reason}</p>
          </div>
        )}
      </div>

      {/* Seller Info */}
      {seller && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Store className="h-4 w-4 text-gray-500" />
            {lbl('Vendedor Responsável', 'Responsible Seller', 'Vendedor Responsable')}
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
              <p className="font-semibold text-gray-900 dark:text-white">{seller.full_name}</p>
              {seller.seller_slug && (
                <p className="text-xs text-gray-500 dark:text-gray-400">@{seller.seller_slug}</p>
              )}
            </div>
            {seller.seller_slug && (
              <a href={`/seller/${seller.seller_slug}`}
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                <ExternalLink className="h-3 w-3" />
                {lbl('Ver loja', 'View store', 'Ver tienda')}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Credentials */}
      {!isCancelled && (
        <div className={`bg-white dark:bg-gray-800 rounded-xl border shadow-sm overflow-hidden ${
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
                        <div className="flex items-center gap-2">
                          <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {lbl('Conta', 'Account', 'Cuenta')} #{idx + 1}
                          </span>
                          {acct.profile_number && (
                            <span className="text-xs text-gray-400">— {lbl('Perfil', 'Profile', 'Perfil')} {acct.profile_number}</span>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
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
                              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{acct.instructions}</p>
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
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{purchase.credentials.instructions}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dispute Notice */}
      {isDisputed && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <span className="font-semibold text-orange-800 dark:text-orange-300">
              {lbl('Disputa Aberta', 'Dispute Open', 'Disputa Abierta')}
            </span>
          </div>
          <p className="text-sm text-orange-700 dark:text-orange-400">
            {lbl('Você abriu uma disputa para esta compra. O vendedor e o suporte estão cientes.', 'You opened a dispute for this purchase. The seller and support are aware.', 'Abriste una disputa para esta compra. El vendedor y soporte están al tanto.')}
          </p>
          {order?.dispute_opened_at && (
            <p className="text-xs text-orange-500 dark:text-orange-500 mt-1">
              {lbl('Aberto em', 'Opened on', 'Abierto el')}: {new Date(order.dispute_opened_at).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')}
            </p>
          )}
        </div>
      )}

      {/* Cancellation Info */}
      {isCancelled && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 text-red-500" />
            <span className="font-semibold text-red-800 dark:text-red-300">
              {lbl('Compra Cancelada', 'Purchase Cancelled', 'Compra Cancelada')}
            </span>
          </div>
          <p className="text-sm text-red-700 dark:text-red-400">
            {lbl('Esta compra foi cancelada e você foi reembolsado automaticamente.', 'This purchase was cancelled and you were automatically refunded.', 'Esta compra fue cancelada y fuiste reembolsado automáticamente.')}
          </p>
        </div>
      )}

      {/* Rating Badge */}
      {!isCancelled && (
        <div className="flex items-center justify-center gap-2 py-2">
          {userRated ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 font-medium">
              <Star className="h-4 w-4 fill-current" />
              {lbl('Produto avaliado por você', 'You rated this product', 'Calificaste este producto')}
            </span>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {lbl('Você ainda não avaliou este produto', 'You haven\'t rated this product yet', 'Aún no calificaste este producto')}
            </span>
          )}
        </div>
      )}
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
