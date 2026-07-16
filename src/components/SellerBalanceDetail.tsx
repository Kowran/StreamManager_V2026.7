import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet, Clock, ShieldAlert, CheckCircle, TrendingUp, Download,
  ChevronDown, ChevronUp, Package, Calendar, DollarSign, Snowflake,
  Unlock, Lock, ArrowUpCircle, Eye, X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useCurrency } from './CurrencyProvider';
import { useLanguage } from './LanguageProvider';

interface CommissionRecord {
  id: string;
  order_id: string;
  seller_id: string;
  total_amount: number;
  admin_commission_rate: number;
  seller_commission_rate: number;
  admin_amount: number;
  seller_amount: number;
  currency: string;
  status: string;
  available_at: string | null;
  withdrawal_id: string | null;
  created_at: string;
  updated_at: string;
  product_name?: string;
  product_image?: string | null;
  customer_name?: string;
  order_status?: string;
  order_quantity?: number;
}

interface WithdrawalRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  requested_at: string;
  approved_at: string | null;
  paid_at: string | null;
  rejection_reason: string | null;
  proof_url: string | null;
  commissions: CommissionRecord[];
}

type Stage = 'available' | 'hold' | 'frozen' | 'withdrawn';

export function SellerBalanceDetail() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { language } = useLanguage();

  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWithdrawal, setExpandedWithdrawal] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<Stage | 'all'>('all');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRecord | null>(null);

  const lbl = useCallback((pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es, [language]);

  useEffect(() => { load(); }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const [commRes, wdRes] = await Promise.all([
        supabase
          .from('sales_commissions')
          .select(`
            id, order_id, seller_id, total_amount, admin_commission_rate,
            seller_commission_rate, admin_amount, seller_amount, currency,
            status, available_at, withdrawal_id, created_at, updated_at
          `)
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('seller_withdrawal_requests')
          .select('id, amount, currency, status, requested_at, approved_at, paid_at, rejection_reason, proof_url')
          .eq('seller_id', user.id)
          .order('requested_at', { ascending: false }),
      ]);

      if (commRes.error) throw commRes.error;
      if (wdRes.error) throw wdRes.error;

      const commData = commRes.data || [];
      const wdData = wdRes.data || [];

      // Fetch product names and customer names for all orders
      const orderIds = [...new Set(commData.map(c => c.order_id))];
      const orderMap: Record<string, any> = {};
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from('store_orders')
          .select(`id, user_id, quantity, status, store_products(name, image_url), profiles!store_orders_user_id_fkey(username, full_name)`)
          .in('id', orderIds);
        (orders || []).forEach((o: any) => {
          orderMap[o.id] = o;
        });
      }

      const mappedCommissions: CommissionRecord[] = commData.map(c => {
        const order = orderMap[c.order_id];
        return {
          ...c,
          product_name: order?.store_products?.name || '',
          product_image: order?.store_products?.image_url || null,
          customer_name: order?.profiles?.username || order?.profiles?.full_name || order?.user_id?.slice(0, 8) || '',
          order_status: order?.status || '',
          order_quantity: order?.quantity || 1,
        };
      });
      setCommissions(mappedCommissions);

      // Map withdrawals with their linked commissions
      const mappedWithdrawals: WithdrawalRecord[] = wdData.map(w => ({
        ...w,
        commissions: mappedCommissions.filter(c => c.withdrawal_id === w.id),
      }));
      setWithdrawals(mappedWithdrawals);
    } catch (error) {
      console.error('Error loading balance data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStage(c: CommissionRecord): Stage {
    if (c.status === 'frozen') return 'frozen';
    if (c.status === 'paid') return 'withdrawn';
    if (c.status === 'cancelled') return 'withdrawn';
    // pending
    if (c.available_at && new Date(c.available_at) <= new Date()) return 'available';
    return 'hold';
  }

  const stageConfig: Record<Stage, { label: string; icon: React.ElementType; color: string; bg: string; border: string; dot: string }> = {
    available: {
      label: lbl('Disponível', 'Available', 'Disponible'),
      icon: Unlock,
      color: 'text-green-700 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      dot: 'bg-green-500',
    },
    hold: {
      label: lbl('Congelado (3 dias)', 'On Hold (3 days)', 'En Espera (3 días)'),
      icon: Clock,
      color: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      dot: 'bg-amber-500',
    },
    frozen: {
      label: lbl('Disputa', 'Disputed', 'Disputa'),
      icon: Snowflake,
      color: 'text-blue-700 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      dot: 'bg-blue-500',
    },
    withdrawn: {
      label: lbl('Sacado', 'Withdrawn', 'Retirado'),
      icon: CheckCircle,
      color: 'text-gray-600 dark:text-gray-400',
      bg: 'bg-gray-50 dark:bg-gray-700/30',
      border: 'border-gray-200 dark:border-gray-700',
      dot: 'bg-gray-400',
    },
  };

  // Stats
  const stats = {
    available: commissions.filter(c => getStage(c) === 'available').reduce((s, c) => s + c.seller_amount, 0),
    hold: commissions.filter(c => getStage(c) === 'hold').reduce((s, c) => s + c.seller_amount, 0),
    frozen: commissions.filter(c => getStage(c) === 'frozen').reduce((s, c) => s + c.seller_amount, 0),
    withdrawn: commissions.filter(c => getStage(c) === 'withdrawn').reduce((s, c) => s + c.seller_amount, 0),
  };

  const filteredCommissions = activeStage === 'all'
    ? commissions
    : commissions.filter(c => getStage(c) === activeStage);

  function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
      day: '2-digit', month: '2-digit', year: '2-digit',
    });
  }

  function formatDateTime(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleString(language === 'pt' ? 'pt-BR' : 'en-US', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }

  function getWithdrawalStatusBadge(status: string) {
    const map: Record<string, { label: string; classes: string }> = {
      pending: { label: lbl('Pendente', 'Pending', 'Pendiente'), classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
      approved: { label: lbl('Aprovado', 'Approved', 'Aprobado'), classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
      paid: { label: lbl('Pago', 'Paid', 'Pagado'), classes: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
      rejected: { label: lbl('Rejeitado', 'Rejected', 'Rechazado'), classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
      cancelled: { label: lbl('Cancelado', 'Cancelled', 'Cancelado'), classes: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' },
    };
    const s = map[status] || { label: status, classes: 'bg-gray-100 text-gray-800' };
    return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${s.classes}`}>{s.label}</span>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Balance Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(stageConfig) as Stage[]).map(stage => {
          const cfg = stageConfig[stage];
          const Icon = cfg.icon;
          const amount = stats[stage];
          const count = commissions.filter(c => getStage(c) === stage).length;
          return (
            <button
              key={stage}
              onClick={() => setActiveStage(activeStage === stage ? 'all' : stage)}
              className={`text-left rounded-xl shadow-sm border p-4 transition-all ${
                activeStage === stage
                  ? `${cfg.bg} ${cfg.border} ring-2 ring-offset-1 ring-current`
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{cfg.label}</span>
                <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${cfg.color}`} />
                </div>
              </div>
              <p className={`text-xl font-bold ${cfg.color}`}>{formatPrice(amount)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{count} {lbl('venda(s)', 'sale(s)', 'venta(s)')}</p>
            </button>
          );
        })}
      </div>

      {/* Commissions List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {activeStage === 'all' ? lbl('Todas as Vendas', 'All Sales', 'Todas las Ventas') : stageConfig[activeStage].label}
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">{filteredCommissions.length} {lbl('registros', 'records', 'registros')}</span>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{lbl('Produto', 'Product', 'Producto')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{lbl('Cliente', 'Customer', 'Cliente')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{lbl('Valor Venda', 'Sale Amount', 'Monto Venta')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{lbl('Sua Comissão', 'Your Commission', 'Tu Comisión')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{lbl('Taxa Admin', 'Admin Fee', 'Comisión Admin')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{lbl('Status', 'Status', 'Estado')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{lbl('Libera em', 'Available', 'Disponible')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredCommissions.map(c => {
                const stage = getStage(c);
                const cfg = stageConfig[stage];
                return (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {c.product_image ? (
                          <img src={c.product_image} alt={c.product_name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-gray-200 dark:border-gray-600" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                            <Package className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[160px]">{c.product_name || '—'}</div>
                          <div className="text-xs text-gray-400">x{c.order_quantity || 1}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{c.customer_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatPrice(c.total_amount)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-green-600 dark:text-green-400">{formatPrice(c.seller_amount)}</td>
                    <td className="px-4 py-3 text-sm text-red-500 dark:text-red-400">{formatPrice(c.admin_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {stage === 'hold' ? formatDate(c.available_at) : stage === 'available' ? lbl('Já disponível', 'Now available', 'Ya disponible') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
          {filteredCommissions.map(c => {
            const stage = getStage(c);
            const cfg = stageConfig[stage];
            return (
              <div key={c.id} className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  {c.product_image ? (
                    <img src={c.product_image} alt={c.product_name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-200 dark:border-gray-600" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.product_name || '—'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{c.customer_name} · x{c.order_quantity || 1}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color} border ${cfg.border} flex-shrink-0`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400">{lbl('Venda', 'Sale', 'Venta')}: </span>
                    <span className="font-medium text-gray-700 dark:text-gray-200">{formatPrice(c.total_amount)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">{lbl('Você', 'You', 'Tú')}: </span>
                    <span className="font-semibold text-green-600 dark:text-green-400">{formatPrice(c.seller_amount)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">{lbl('Taxa', 'Fee', 'Comisión')}: </span>
                    <span className="text-red-500 dark:text-red-400">{formatPrice(c.admin_amount)}</span>
                  </div>
                </div>
                {stage === 'hold' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {lbl('Libera em', 'Available', 'Disponible')}: {formatDate(c.available_at)}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {filteredCommissions.length === 0 && (
          <div className="text-center py-16">
            <Wallet className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {lbl('Nenhuma venda neste status', 'No sales in this status', 'Sin ventas en este estado')}
            </p>
          </div>
        )}
      </div>

      {/* Withdrawals Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowUpCircle className="h-4 w-4 text-blue-500" />
            {lbl('Histórico de Saques', 'Withdrawal History', 'Historial de Retiros')}
          </h3>
        </div>

        {withdrawals.length === 0 ? (
          <div className="text-center py-12">
            <ArrowUpCircle className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {lbl('Nenhum saque solicitado', 'No withdrawals requested', 'Sin retiros solicitados')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {withdrawals.map(w => (
              <div key={w.id}>
                <button
                  onClick={() => setExpandedWithdrawal(expandedWithdrawal === w.id ? null : w.id)}
                  className="w-full text-left px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                        <ArrowUpCircle className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-900 dark:text-white">{formatPrice(w.amount)}</span>
                          {getWithdrawalStatusBadge(w.status)}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(w.requested_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {w.commissions.length > 0 && (
                        <span className="text-xs text-gray-400 hidden sm:inline">
                          {w.commissions.length} {lbl('venda(s)', 'sale(s)', 'venta(s)')}
                        </span>
                      )}
                      {w.commissions.length > 0 && (
                        expandedWithdrawal === w.id
                          ? <ChevronUp className="h-4 w-4 text-gray-400" />
                          : <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                  {w.status === 'rejected' && w.rejection_reason && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-2 pl-12">
                      {lbl('Motivo:', 'Reason:', 'Motivo:')} {w.rejection_reason}
                    </p>
                  )}
                  {w.proof_url && w.status === 'paid' && (
                    <a href={w.proof_url} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-xs text-blue-500 hover:text-blue-600 mt-2 pl-12 inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" /> {lbl('Ver comprovante', 'View proof', 'Ver comprobante')}
                    </a>
                  )}
                </button>

                {/* Expanded: show which sales are in this withdrawal */}
                {expandedWithdrawal === w.id && w.commissions.length > 0 && (
                  <div className="px-4 pb-4 pt-1 bg-gray-50 dark:bg-gray-700/20">
                    <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                      <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                          {lbl('Vendas inclusas neste saque', 'Sales included in this withdrawal', 'Ventas incluidas en este retiro')}
                        </p>
                      </div>
                      <div className="divide-y divide-gray-200 dark:divide-gray-600">
                        {w.commissions.map(c => (
                          <div key={c.id} className="px-3 py-2.5 flex items-center gap-3">
                            {c.product_image ? (
                              <img src={c.product_image} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                                <Package className="h-3.5 w-3.5 text-blue-400" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{c.product_name || '—'}</p>
                              <p className="text-xs text-gray-400">{c.customer_name} · {formatDate(c.created_at)}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs font-semibold text-green-600 dark:text-green-400">{formatPrice(c.seller_amount)}</p>
                              <p className="text-xs text-gray-400">{lbl('Venda:', 'Sale:', 'Venta:')} {formatPrice(c.total_amount)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{lbl('Total do Saque', 'Withdrawal Total', 'Total del Retiro')}</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{formatPrice(w.amount)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* If no linked commissions (pre-link era withdrawals) */}
                {expandedWithdrawal === w.id && w.commissions.length === 0 && (
                  <div className="px-4 pb-4 pt-1 bg-gray-50 dark:bg-gray-700/20">
                    <p className="text-xs text-gray-400 text-center py-3">
                      {lbl('Detalhe das vendas não disponível para saques anteriores ao rastreamento.', 'Sale details not available for pre-tracking withdrawals.', 'Detalles de ventas no disponibles para retiros anteriores al seguimiento.')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
