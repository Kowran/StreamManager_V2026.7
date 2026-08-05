import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Copy, Check, Clock, AlertTriangle, CheckCircle, XCircle,
  Truck, ShoppingBag, ChevronRight, Star, HelpCircle, ShieldAlert,
  ExternalLink, DollarSign, Tag, Zap, CheckCheck, MessageCircle,
  Layers, Store, Calendar, FileText, Ban, Package,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { ChatModal } from './ChatModal';
import { PurchaseHelpModal } from './PurchaseHelpModal';
import { buildProductUrl } from '../lib/productUrl';
import ProductImage from './ProductImage';

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
    is_featured?: boolean;
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

function calcExpiry(purchaseDate: string): Date {
  return new Date(new Date(purchaseDate).getTime() + 30 * 24 * 60 * 60 * 1000);
}

function daysLeft(purchaseDate: string): number {
  return Math.ceil((calcExpiry(purchaseDate).getTime() - Date.now()) / 86400000);
}

export function PurchaseDetailPage({ purchaseId, onBack }: PurchaseDetailProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();

  const [purchase, setPurchase] = useState<FullPurchase | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [userRated, setUserRated] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [disputeTicket, setDisputeTicket] = useState<any | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [productExists, setProductExists] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);

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

  useEffect(() => { load(); }, [purchaseId]);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_purchases')
        .select(`
          *,
          store_products!user_purchases_product_id_fkey (
            image_url, category, description, name, price_usdt, seller_id, is_featured
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
        const { data: sd } = await supabase
          .from('profiles').select('id, full_name, avatar_url, seller_slug, theme_color, username')
          .eq('id', sellerId).maybeSingle();
        if (sd) setSeller(sd);
      }

      const oid = (data.store_orders as any)?.id;
      if (oid) {
        const { data: r } = await supabase.from('product_ratings').select('id')
          .eq('user_id', user.id).eq('product_id', data.product_id).eq('order_id', oid).maybeSingle();
        setUserRated(!!r);

        const { data: tk } = await supabase.from('seller_support_tickets')
          .select('id, ticket_number, subject, status, escalated, admin_resolved, resolution_type, resolution_notes, resolved_at')
          .eq('order_id', oid).eq('customer_id', user.id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        setDisputeTicket(tk);
      }

      if (data.product_id) {
        const { data: p } = await supabase.from('store_products').select('id')
          .eq('id', data.product_id).maybeSingle();
        setProductExists(!!p);
      }
    } catch (e) { console.error('load error', e); }
    finally { setLoading(false); }
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(text); setTimeout(() => setCopied(null), 2000); }
    catch { /* noop */ }
  }

  async function withdrawDispute() {
    if (!purchase?.store_orders?.id) return;
    setWithdrawing(true);
    try {
      const { data, error } = await supabase.rpc('withdraw_customer_dispute', { p_order_id: purchase.store_orders.id });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error);
      setShowWithdraw(false);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setWithdrawing(false); }
  }

  async function confirmDelivery() {
    if (!purchase?.store_orders?.id) return;
    setConfirming(true); setConfirmError(null);
    try {
      const { data, error } = await supabase.rpc('confirm_customer_delivery', { p_order_id: purchase.store_orders.id });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error);
      await load();
    } catch (e: any) { setConfirmError(e.message); }
    finally { setConfirming(false); }
  }

  function testDaysLeft(): number {
    const o = purchase?.store_orders;
    if (!o?.created_at) return 0;
    return Math.max(0, Math.ceil((new Date(o.created_at).getTime() + 259200000 - Date.now()) / 86400000));
  }

  function toggleAcct(i: number) {
    setExpanded(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i]);
    if (purchase && !(purchase.read_accounts || []).includes(i)) {
      const nr = [...(purchase.read_accounts || []), i];
      supabase.from('user_purchases').update({ read_accounts: nr }).eq('id', purchase.id);
      setPurchase(p => p ? { ...p, read_accounts: nr } : p);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
    </div>
  );
  if (!purchase) return null;

  const order = purchase.store_orders as any;
  const isCancelled = order?.status === 'cancelled';
  const isDisputed = order?.status === 'disputed';
  const isCompleted = order?.status === 'completed';
  const isDelivered = order?.status === 'delivered';
  const isPaid = ['paid', 'delivered', 'completed', 'disputed'].includes(order?.status || '');
  const dRem = daysLeft(purchase.purchase_date);
  const isExpired = dRem <= 0;
  const expDate = calcExpiry(purchase.purchase_date);
  const accts = purchase.credentials?.accounts;
  const isMulti = Array.isArray(accts) && accts.length > 0;
  const desc = purchase.store_products?.description || '';
  const longDesc = desc.length > 180;

  const st = isCancelled
    ? { label: lbl('Cancelado', 'Cancelled', 'Cancelado'), icon: XCircle, cls: 'text-red-500', bg: 'bg-red-500/10', ring: 'ring-red-500/30' }
    : isDisputed
    ? { label: lbl('Em Disputa', 'In Dispute', 'En Disputa'), icon: AlertTriangle, cls: 'text-orange-400', bg: 'bg-orange-500/10', ring: 'ring-orange-500/30' }
    : isExpired
    ? { label: lbl('Expirado', 'Expired', 'Expirado'), icon: AlertTriangle, cls: 'text-red-400', bg: 'bg-red-500/10', ring: 'ring-red-500/30' }
    : isCompleted
    ? { label: lbl('Finalizado', 'Completed', 'Finalizado'), icon: CheckCircle, cls: 'text-green-400', bg: 'bg-green-500/10', ring: 'ring-green-500/30' }
    : isDelivered
    ? { label: lbl('Entregue', 'Delivered', 'Entregado'), icon: Truck, cls: 'text-blue-400', bg: 'bg-blue-500/10', ring: 'ring-blue-500/30' }
    : { label: lbl('Em andamento', 'In Progress', 'En progreso'), icon: Clock, cls: 'text-blue-400', bg: 'bg-blue-500/10', ring: 'ring-blue-500/30' };

  const SIcon = st.icon;

  const steps = [
    { label: lbl('Pagamento', 'Payment', 'Pago'), done: isPaid || isCompleted || isDelivered, date: order?.created_at },
    { label: lbl('Entrega', 'Delivery', 'Entrega'), done: isCompleted || isDelivered, date: (isDelivered || isCompleted) ? order?.updated_at : null },
    { label: lbl('Finalizado', 'Completed', 'Finalizado'), done: isCompleted, date: isCompleted ? order?.updated_at : null },
  ];

  /* ===== CARD base classes ===== */
  const card = 'bg-gray-900 dark:bg-gray-900 border border-gray-700/60 rounded-2xl';

  return (
    <div className="w-full h-full px-4 py-5 pb-8">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-5">
        <ArrowLeft className="h-4 w-4" />
        {lbl('Minhas Compras', 'My Purchases', 'Mis Compras')}
      </button>

      {/* ===== TWO-COLUMN GRID ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

        {/* ===== LEFT COLUMN ===== */}
        <div className="flex flex-col gap-4">

          {/* Product Header */}
          <div className={`${card} p-4`}>
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 flex-shrink-0">
                <ProductImage
                  src={purchase.store_products?.image_url}
                  alt={purchase.product_name}
                  rounded="rounded-xl"
                  grayscale={isCancelled || isExpired}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold text-white leading-snug break-words">
                  {purchase.product_name}
                </h1>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${st.bg} ${st.cls} ring-1 ${st.ring}`}>
                    <SIcon className="h-3 w-3" />{st.label}
                  </span>
                  {purchase.credentials?.variation_name && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                      <Layers className="h-3 w-3" />{purchase.credentials.variation_name}
                    </span>
                  )}
                  {purchase.store_products?.category && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                      <Tag className="h-3 w-3" />{purchase.store_products.category}
                    </span>
                  )}
                </div>
                <p className="text-lg font-bold text-green-400 mt-2">
                  {formatPrice(purchase.purchase_price)}
                </p>
              </div>
            </div>

            {desc && (
              <div className="mt-3 pt-3 border-t border-gray-700/60">
                <p className={`text-xs text-gray-400 leading-relaxed break-words whitespace-pre-wrap ${showFullDesc ? '' : longDesc ? 'line-clamp-3' : ''}`}>
                  {desc}
                </p>
                {longDesc && (
                  <button onClick={() => setShowFullDesc(!showFullDesc)} className="text-xs text-blue-400 hover:underline font-medium mt-1">
                    {showFullDesc ? lbl('Ver menos', 'Show less', 'Ver menos') : lbl('Ver mais', 'Show more', 'Ver más')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Progress */}
          {!isCancelled && (
            <div className={`${card} p-4`}>
              <div className="flex items-center justify-between">
                {steps.map((s, i) => (
                  <React.Fragment key={i}>
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                        s.done
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'bg-gray-800 border-gray-600 text-gray-500'
                      }`}>
                        {s.done ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                      </div>
                      <p className={`mt-1.5 text-xs font-medium text-center ${s.done ? 'text-green-400' : 'text-gray-500'}`}>{s.label}</p>
                      {s.done && s.date && (
                        <p className="text-[10px] text-gray-500 mt-0.5 text-center">{fmtDate(s.date)}</p>
                      )}
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`h-0.5 w-full mx-1 mb-6 ${steps[i].done && steps[i + 1].done ? 'bg-green-500' : 'bg-gray-700'}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Credentials */}
          {!isCancelled && (
            <div className={`${card} overflow-hidden`}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700/60">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isExpired ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                  {isExpired ? <XCircle className="h-3.5 w-3.5 text-red-400" /> : <CheckCircle className="h-3.5 w-3.5 text-green-400" />}
                </div>
                <h2 className="text-sm font-semibold text-white">
                  {lbl('Credenciais', 'Credentials', 'Credenciales')}
                  {isMulti && <span className="text-xs font-normal text-gray-400 ml-1">({accts.length})</span>}
                </h2>
                {isExpired && (
                  <span className="ml-auto text-xs text-red-400 font-medium">{lbl('Expirado', 'Expired', 'Expirado')}</span>
                )}
              </div>
              <div className="p-4">
                {isMulti ? (
                  <div className="space-y-2">
                    {accts.map((a: any, i: number) => {
                      const exp = expanded.includes(i);
                      const wasRead = (purchase.read_accounts || []).includes(i) || expanded.includes(i);
                      return (
                        <div key={i} className="rounded-xl border border-gray-700/60 overflow-hidden">
                          <button onClick={() => toggleAcct(i)} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-800/60 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                              <ChevronRight className={`h-3.5 w-3.5 text-gray-400 transition-transform flex-shrink-0 ${exp ? 'rotate-90' : ''}`} />
                              <span className="text-sm font-medium text-gray-200 truncate">{lbl('Conta', 'Account', 'Cuenta')} #{i + 1}</span>
                              {a.profile_number && <span className="text-xs text-gray-500 truncate">— {a.profile_number}</span>}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${wasRead ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                              {wasRead ? lbl('Lida', 'Read', 'Leída') : lbl('Nova', 'New', 'Nueva')}
                            </span>
                          </button>
                          {exp && (
                            <div className="px-4 pb-4 pt-2 border-t border-gray-700/40 bg-gray-800/40 space-y-2.5">
                              {a.email && <CredRow label="Email" value={a.email} onCopy={copy} copied={copied} />}
                              {a.password && <CredRow label={lbl('Senha', 'Password', 'Contraseña')} value={a.password} onCopy={copy} copied={copied} />}
                              {a.pin && <CredRow label="PIN" value={a.pin} onCopy={copy} copied={copied} />}
                              {a.instructions && (
                                <div className="pt-2 border-t border-gray-700/40">
                                  <p className="text-xs font-medium text-gray-500 mb-1">{lbl('Instruções', 'Instructions', 'Instrucciones')}</p>
                                  <p className="text-xs text-gray-300 whitespace-pre-wrap break-words max-h-28 overflow-y-auto">{a.instructions}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl bg-gray-800/40 p-3 space-y-2.5">
                    {purchase.credentials?.email && <CredRow label="Email" value={purchase.credentials.email} onCopy={copy} copied={copied} />}
                    {purchase.credentials?.password && <CredRow label={lbl('Senha', 'Password', 'Contraseña')} value={purchase.credentials.password} onCopy={copy} copied={copied} />}
                    {purchase.credentials?.pin && <CredRow label="PIN" value={purchase.credentials.pin} onCopy={copy} copied={copied} />}
                    {purchase.credentials?.instructions && (
                      <div className="pt-2 border-t border-gray-700/40">
                        <p className="text-xs font-medium text-gray-500 mb-1">{lbl('Instruções', 'Instructions', 'Instrucciones')}</p>
                        <p className="text-xs text-gray-300 whitespace-pre-wrap break-words max-h-28 overflow-y-auto">{purchase.credentials.instructions}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ===== RIGHT COLUMN ===== */}
        <div className="flex flex-col gap-4">

          {/* Order Details */}
          <div className={`${card} p-4`}>
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-gray-400" />
              {lbl('Detalhes do Pedido', 'Order Details', 'Detalles del Pedido')}
            </h2>
            <dl className="space-y-0">
              <DlRow icon={FileText} label={lbl('ID', 'ID', 'ID')} value={
                <span className="font-mono text-xs text-gray-400 truncate">{order?.id?.slice(0, 8) || '—'}...</span>
              } />
              <DlRow icon={Calendar} label={lbl('Data', 'Date', 'Fecha')} value={
                <span className="text-sm font-medium text-gray-200">{fmtDate(purchase.purchase_date)}</span>
              } />
              <DlRow icon={DollarSign} label={lbl('Valor', 'Amount', 'Monto')} value={
                <span className="text-sm font-bold text-green-400">{formatPrice(purchase.purchase_price)}</span>
              } />
              {order?.discount_amount > 0 && (
                <DlRow icon={Tag} label={lbl('Desconto', 'Discount', 'Descuento')} value={
                  <span className="text-sm font-semibold text-emerald-400">-{formatPrice(order.discount_amount)}</span>
                } />
              )}
              {order?.cashback_used > 0 && (
                <DlRow icon={Zap} label="Cashback" value={
                  <span className="text-sm font-semibold text-amber-400">-{formatPrice(order.cashback_used)}</span>
                } />
              )}
              <DlRow icon={Clock} label={lbl('Expira', 'Expires', 'Expira')} value={
                <span className={`text-sm font-medium ${isExpired ? 'text-red-400' : 'text-gray-200'}`}>{fmtDate(expDate.toISOString())}</span>
              } last />
            </dl>
          </div>

          {/* Test period / Confirm */}
          {!isCancelled && !isCompleted && (
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-blue-300">{lbl('Período de Teste', 'Test Period', 'Período de Prueba')}</h3>
                  <p className="text-xs text-blue-400 mt-0.5 leading-relaxed">
                    {lbl('Confirme o recebimento para finalizar.', 'Confirm delivery to finalize.', 'Confirma la entrega para finalizar.')}
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30">
                    <Clock className="h-3 w-3 text-blue-400" />
                    <span className="text-xs font-medium text-blue-300">
                      {(() => { const d = testDaysLeft(); return d > 0 ? `${d} ${lbl('dia(s) restante(s)', 'day(s) left', 'día(s) restante(s)')}` : lbl('Encerrado', 'Ended', 'Terminado'); })()}
                    </span>
                  </div>
                </div>
              </div>
              {confirmError && (
                <div className="flex items-center gap-2 px-3 py-2 mt-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                  <span className="text-xs text-red-400">{confirmError}</span>
                </div>
              )}
              <button onClick={confirmDelivery} disabled={confirming}
                className="w-full mt-3 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {confirming
                  ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />{lbl('Confirmando...', 'Confirming...', 'Confirmando...')}</>
                  : <><CheckCheck className="h-4 w-4" />{lbl('Confirmar Recebimento', 'Confirm Delivery', 'Confirmar Recepción')}</>}
              </button>
            </div>
          )}

          {/* Completed */}
          {!isCancelled && isCompleted && order?.delivered_at && (
            <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-300">{lbl('Recebimento Confirmado', 'Delivery Confirmed', 'Recepción Confirmada')}</p>
                <p className="text-xs text-green-400">{fmtDateTime(order.delivered_at)}</p>
              </div>
            </div>
          )}

          {/* Dispute open */}
          {isDisputed && (
            <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-semibold text-orange-300">{lbl('Disputa Aberta', 'Dispute Open', 'Disputa Abierta')}</span>
              </div>
              <p className="text-xs text-orange-400 leading-relaxed">
                {lbl('Você abriu uma disputa. O vendedor e o suporte estão cientes.', 'You opened a dispute. The seller and support are aware.', 'Abriste una disputa. El vendedor y soporte están al tanto.')}
              </p>
              {order?.dispute_opened_at && (
                <p className="text-xs text-orange-500 mt-1">{lbl('Em', 'On', 'El')}: {fmtDateTime(order.dispute_opened_at)}</p>
              )}
              {!disputeTicket?.admin_resolved && (
                <div className="mt-3">
                  {!showWithdraw ? (
                    <button onClick={() => setShowWithdraw(true)}
                      className="w-full px-4 py-2 rounded-xl border border-orange-500/40 text-orange-400 text-xs font-medium hover:bg-orange-500/10 transition-colors flex items-center justify-center gap-1.5">
                      <Ban className="h-3.5 w-3.5" />{lbl('Desistir da Disputa', 'Withdraw Dispute', 'Desistir de la Disputa')}
                    </button>
                  ) : (
                    <div className="space-y-2 rounded-xl bg-gray-800/60 border border-orange-500/20 p-3">
                      <p className="text-xs text-gray-300 leading-relaxed">
                        {lbl('Tem certeza? Não é possível reabrir.', 'Are you sure? Cannot be reopened.', '¿Estás seguro? No se puede reabrir.')}
                      </p>
                      <div className="flex gap-2">
                        <button onClick={withdrawDispute} disabled={withdrawing}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                          {withdrawing ? <div className="animate-spin rounded-full h-3 w-3 border-b border-white" /> : <Check className="h-3 w-3" />}
                          {lbl('Sim', 'Yes', 'Sí')}
                        </button>
                        <button onClick={() => setShowWithdraw(false)} disabled={withdrawing}
                          className="flex-1 px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 text-xs font-medium hover:bg-gray-700 transition-colors disabled:opacity-50">
                          {lbl('Não', 'No', 'No')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Dispute resolved */}
          {disputeTicket?.admin_resolved && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-300">{lbl('Disputa Resolvida', 'Dispute Resolved', 'Disputa Resuelta')}</span>
              </div>
              <p className="text-xs text-emerald-400 mb-2">
                {disputeTicket.resolution_type === 'refund' ? lbl('Reembolso ao cliente', 'Refund to customer', 'Reembolso al cliente')
                  : disputeTicket.resolution_type === 'replace_account' ? lbl('Substituição de produto', 'Product replacement', 'Reemplazo de producto')
                  : lbl('Disputa encerrada', 'Dispute closed', 'Disputa cerrada')}
              </p>
              {disputeTicket.resolution_notes && (
                <div className="text-xs text-emerald-400 bg-gray-800/40 rounded-lg p-2.5 max-h-32 overflow-y-auto mb-2">
                  <p className="whitespace-pre-wrap break-words">{disputeTicket.resolution_notes}</p>
                </div>
              )}
              {disputeTicket.resolved_at && <p className="text-xs text-emerald-500">{fmtDateTime(disputeTicket.resolved_at)}</p>}
            </div>
          )}

          {/* Cancelled */}
          {isCancelled && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-sm font-semibold text-red-300">{lbl('Compra Cancelada', 'Purchase Cancelled', 'Compra Cancelada')}</span>
              </div>
              <p className="text-xs text-red-400 leading-relaxed">
                {lbl('Esta compra foi cancelada e você foi reembolsado.', 'This purchase was cancelled and you were refunded.', 'Esta compra fue cancelada y fuiste reembolsado.')}
              </p>
              {order?.cancellation_reason && <p className="text-xs text-red-500 mt-1 break-words">{order.cancellation_reason}</p>}
            </div>
          )}

          {/* Seller */}
          {seller && (
            <div className={`${card} p-4`}>
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Store className="h-4 w-4 text-gray-400" />
                {lbl('Vendedor', 'Seller', 'Vendedor')}
              </h2>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: seller.theme_color || '#3b82f6' }}>
                  {seller.avatar_url
                    ? <img src={seller.avatar_url} alt={seller.full_name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm" style={{ background: seller.theme_color || '#3b82f6' }}>{seller.full_name?.[0]?.toUpperCase() || 'S'}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => { const id = seller.username || seller.id; if (id) { window.history.pushState(null, '', `/user/${id}`); window.dispatchEvent(new PopStateEvent('popstate')); } }}
                    className="text-sm font-semibold text-white hover:underline text-left truncate block">
                    {seller.username || seller.full_name}
                  </button>
                  {seller.seller_slug && <p className="text-xs text-gray-500 truncate">@{seller.seller_slug}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button onClick={() => setShowChat(true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors">
                  <MessageCircle className="h-3.5 w-3.5" />{lbl('Conversar', 'Chat', 'Chatear')}
                </button>
                {seller.seller_slug && (
                  <a href={`/seller/${seller.seller_slug}`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-700 text-gray-300 text-xs font-semibold hover:bg-gray-800 transition-colors">
                    <ExternalLink className="h-3.5 w-3.5" />{lbl('Ver loja', 'Store', 'Tienda')}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {!isCancelled && (
            <div className={`${card} p-4`}>
              <div className="grid grid-cols-2 gap-2">
                {productExists ? (
                  <button
                    onClick={() => { const u = buildProductUrl(purchase.product_name, purchase.product_id); window.history.pushState(null, '', u); window.dispatchEvent(new PopStateEvent('popstate')); }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white text-gray-900 text-xs font-semibold hover:bg-gray-100 transition-colors">
                    <ExternalLink className="h-3.5 w-3.5" />{lbl('Ver Anúncio', 'View Listing', 'Ver Anuncio')}
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-gray-800 text-gray-500 text-xs">
                    <Package className="h-3.5 w-3.5" />{lbl('Indisponível', 'Unavailable', 'No Disponible')}
                  </div>
                )}
                <button onClick={() => setShowHelp(true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-blue-500/40 text-blue-400 text-xs font-semibold hover:bg-blue-500/10 transition-colors">
                  <HelpCircle className="h-3.5 w-3.5" />{lbl('Preciso de Ajuda', 'Need Help', 'Necesito Ayuda')}
                </button>
              </div>
              <div className="mt-3 flex items-center justify-center">
                {userRated ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-yellow-500/10 text-yellow-400 font-medium border border-yellow-500/20">
                    <Star className="h-3 w-3 fill-current" />{lbl('Produto avaliado', 'Product rated', 'Producto calificado')}
                  </span>
                ) : (
                  <p className="text-xs text-gray-500">{lbl('Você ainda não avaliou este produto', "You haven't rated this product yet", 'Aún no calificaste este producto')}</p>
                )}
              </div>
            </div>
          )}

          {/* Safety notice */}
          {seller && !isCancelled && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 flex items-start gap-3">
              <ShieldAlert className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-300">{lbl('Comunique-se apenas pela plataforma', 'Platform-only communication', 'Comunicación solo por la plataforma')}</p>
                <p className="text-xs text-amber-400/80 mt-0.5 leading-relaxed">
                  {lbl('Não compartilhe nem aceite contatos externos.', 'Do not share or accept external contacts.', 'No compartas ni aceptes contactos externos.')}
                </p>
              </div>
            </div>
          )}

        </div>
        {/* END RIGHT COLUMN */}
      </div>

      {/* Modals */}
      {showChat && seller && order && (
        <ChatModal
          otherUserId={seller.id}
          onClose={() => setShowChat(false)}
          orderContext={{
            orderId: order.id,
            productName: purchase.product_name,
            productImage: purchase.store_products?.image_url || undefined,
            quantity: 1,
            totalUsdt: order.total_usdt || 0,
            customerName: order.customer_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '',
          }}
        />
      )}
      {showHelp && purchase && (
        <PurchaseHelpModal
          isOpen={showHelp}
          onClose={() => { setShowHelp(false); load(); }}
          purchase={{ id: purchase.id, product_id: purchase.product_id, order_id: purchase.order_id, product_name: purchase.product_name, purchase_price: purchase.purchase_price }}
          sellerId={seller?.id || null}
        />
      )}
    </div>
  );
}

function DlRow({ icon: Icon, label, value, last }: { icon: any; label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 py-2 ${!last ? 'border-b border-gray-700/40' : ''}`}>
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="text-right min-w-0 shrink-0">{value}</div>
    </div>
  );
}

function CredRow({ label, value, onCopy, copied }: { label: string; value: string; onCopy: (v: string) => void; copied: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
        <p className="font-mono text-xs text-gray-200 break-all">{value}</p>
      </div>
      <button
        onClick={() => onCopy(value)}
        className="flex-shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-700 transition-colors"
        title="Copiar"
      >
        {copied === value ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
