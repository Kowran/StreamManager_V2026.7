import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import {
  Wallet, Check, X, Clock, Download, Search, ChevronLeft, ChevronRight,
  DollarSign, ChevronDown, ChevronUp, Package, Eye
} from 'lucide-react';

interface WithdrawalRequest {
  id: string;
  seller_id: string;
  amount: number;
  currency: string;
  status: string;
  requested_at: string;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  paid_by: string | null;
  rejection_reason: string | null;
  processing_notes: string | null;
  proof_url: string | null;
  created_at: string;
  updated_at: string;
  seller?: { username: string; email: string };
}

interface LinkedCommission {
  id: string;
  order_id: string;
  total_amount: number;
  seller_amount: number;
  admin_amount: number;
  status: string;
  created_at: string;
  product_name?: string;
  product_image?: string | null;
  customer_name?: string;
  order_quantity?: number;
}

export function AdminWithdrawalManager() {
  const { language } = useLanguage();
  const { formatPrice } = useCurrency();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<WithdrawalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmModal, setConfirmModal] = useState<WithdrawalRequest | null>(null);
  const [proofUrl, setProofUrl] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [commissionsCache, setCommissionsCache] = useState<Record<string, LinkedCommission[]>>({});
  const [loadingCommissions, setLoadingCommissions] = useState<string | null>(null);
  const pageSize = 20;

  const lbl = (pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es;

  useEffect(() => {
    loadWithdrawals();
    const channel = supabase
      .channel('withdrawal-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seller_withdrawal_requests' }, () => {
        loadWithdrawals();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [page, statusFilter]);

  async function loadWithdrawals() {
    setLoading(true);
    try {
      let query = supabase
        .from('seller_withdrawal_requests')
        .select(`*, seller:seller_id (username, email)`)
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      if (data) {
        setWithdrawals(data.slice(0, pageSize));
        setHasMore(data.length === pageSize);
      }
    } catch (error) {
      console.error('Error loading withdrawals:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadCommissions(withdrawalId: string) {
    if (commissionsCache[withdrawalId]) return;
    setLoadingCommissions(withdrawalId);
    try {
      const { data: commissions, error: commError } = await supabase
        .from('sales_commissions')
        .select('id, order_id, total_amount, seller_amount, admin_amount, status, created_at')
        .eq('withdrawal_id', withdrawalId)
        .order('created_at', { ascending: true });
      if (commError) throw commError;

      const orderIds = [...new Set((commissions || []).map(c => c.order_id))];
      const orderMap: Record<string, any> = {};
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from('store_orders')
          .select(`id, user_id, quantity, store_products(name, image_url), profiles!store_orders_user_id_fkey(username, full_name)`)
          .in('id', orderIds);
        (orders || []).forEach((o: any) => { orderMap[o.id] = o; });
      }

      const mapped: LinkedCommission[] = (commissions || []).map(c => {
        const order = orderMap[c.order_id];
        return {
          ...c,
          product_name: order?.store_products?.name || '',
          product_image: order?.store_products?.image_url || null,
          customer_name: order?.profiles?.username || order?.profiles?.full_name || '',
          order_quantity: order?.quantity || 1,
        };
      });
      setCommissionsCache(prev => ({ ...prev, [withdrawalId]: mapped }));
    } catch (error) {
      console.error('Error loading commissions:', error);
    } finally {
      setLoadingCommissions(null);
    }
  }

  function toggleRow(id: string) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        loadCommissions(id);
      }
      return next;
    });
  }

  async function handleAction(withdrawal: WithdrawalRequest, action: string) {
    setActionLoading(withdrawal.id);
    try {
      const { data, error } = await supabase.rpc('process_withdrawal_approval', {
        p_withdrawal_id: withdrawal.id, p_action: action, p_admin_notes: null, p_payment_proof_url: null,
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error);
      setCommissionsCache({});
      await loadWithdrawals();
    } catch (error) {
      alert(lbl('Erro: ', 'Error: ', 'Error: ') + (error instanceof Error ? error.message : ''));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject() {
    if (!rejectModal || !rejectReason.trim()) return;
    setActionLoading(rejectModal.id);
    try {
      const { data, error } = await supabase.rpc('process_withdrawal_approval', {
        p_withdrawal_id: rejectModal.id, p_action: 'reject', p_admin_notes: rejectReason.trim(), p_payment_proof_url: null,
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error);
      setRejectModal(null);
      setRejectReason('');
      await loadWithdrawals();
    } catch (error) {
      alert(lbl('Erro: ', 'Error: ', 'Error: ') + (error instanceof Error ? error.message : ''));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleConfirmPayment() {
    if (!confirmModal) return;
    setActionLoading(confirmModal.id);
    try {
      const { data, error } = await supabase.rpc('process_withdrawal_approval', {
        p_withdrawal_id: confirmModal.id, p_action: 'confirm_payment', p_admin_notes: null, p_payment_proof_url: proofUrl.trim() || null,
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error);
      setConfirmModal(null);
      setProofUrl('');
      setCommissionsCache({});
      await loadWithdrawals();
    } catch (error) {
      alert(lbl('Erro: ', 'Error: ', 'Error: ') + (error instanceof Error ? error.message : ''));
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = withdrawals.filter(w => {
    if (!searchTerm) return true;
    const sellerName = w.seller?.username || w.seller?.email || '';
    return sellerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           w.id.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const stats = {
    total: withdrawals.length,
    pending: withdrawals.filter(w => w.status === 'pending').length,
    approved: withdrawals.filter(w => w.status === 'approved').length,
    paid: withdrawals.filter(w => w.status === 'paid').length,
    rejected: withdrawals.filter(w => w.status === 'rejected').length,
    totalAmount: withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + Number(w.amount), 0),
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
      approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      paid: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    };
    const labels: Record<string, string> = {
      pending: lbl('Pendente', 'Pending', 'Pendiente'),
      approved: lbl('Aprovado', 'Approved', 'Aprobado'),
      paid: lbl('Pago', 'Paid', 'Pagado'),
      rejected: lbl('Rejeitado', 'Rejected', 'Rechazado'),
    };
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>{labels[status] || status}</span>;
  };

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Wallet className="h-6 w-6 text-blue-500" />
          {lbl('Gestão de Saques', 'Withdrawal Management', 'Gestión de Retiros')}
        </h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{lbl('Total', 'Total', 'Total')}</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-200 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{lbl('Pendentes', 'Pending', 'Pendientes')}</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{lbl('Aprovados', 'Approved', 'Aprobados')}</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.approved}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{lbl('Pagos', 'Paid', 'Pagados')}</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.paid}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{lbl('Valor Pendente', 'Pending Amount', 'Monto Pendiente')}</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{formatPrice(stats.totalAmount)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder={lbl('Buscar por vendedor...', 'Search by seller...', 'Buscar por vendedor...')}
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
          <option value="all">{lbl('Todos os Status', 'All Statuses', 'Todos los Estados')}</option>
          <option value="pending">{lbl('Pendente', 'Pending', 'Pendiente')}</option>
          <option value="approved">{lbl('Aprovado', 'Approved', 'Aprobado')}</option>
          <option value="paid">{lbl('Pago', 'Paid', 'Pagado')}</option>
          <option value="rejected">{lbl('Rejeitado', 'Rejected', 'Rechazado')}</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">{lbl('Carregando...', 'Loading...', 'Cargando...')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">{lbl('Nenhum saque encontrado', 'No withdrawals found', 'No se encontraron retiros')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400 w-8"></th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{lbl('Vendedor', 'Seller', 'Vendedor')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{lbl('Valor', 'Amount', 'Monto')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{lbl('Status', 'Status', 'Estado')}</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">{lbl('Data', 'Date', 'Fecha')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">{lbl('Ações', 'Actions', 'Acciones')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map(w => {
                  const isExpanded = expandedRows.has(w.id);
                  const commissions = commissionsCache[w.id] || [];
                  return (
                    <React.Fragment key={w.id}>
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3">
                          {w.status === 'paid' && (
                            <button onClick={() => toggleRow(w.id)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800 dark:text-gray-200">
                            {w.seller?.username || lbl('Usuário', 'User', 'Usuario')}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {w.seller?.email || w.seller_id.slice(0, 8) + '...'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-gray-800 dark:text-gray-200">{formatPrice(Number(w.amount))}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">{w.currency}</span>
                        </td>
                        <td className="px-4 py-3">{statusBadge(w.status)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatDate(w.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {w.status === 'pending' && (
                              <>
                                <button onClick={() => handleAction(w, 'approve')} disabled={actionLoading === w.id} title={lbl('Aprovar', 'Approve', 'Aprobar')}
                                  className="p-1.5 bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 rounded-md hover:bg-green-200 dark:hover:bg-green-900/30 disabled:opacity-50">
                                  <Check className="h-4 w-4" />
                                </button>
                                <button onClick={() => { setRejectModal(w); setRejectReason(''); }} disabled={actionLoading === w.id} title={lbl('Rejeitar', 'Reject', 'Rechazar')}
                                  className="p-1.5 bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/30 disabled:opacity-50">
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            {w.status === 'approved' && (
                              <>
                                <button onClick={() => { setConfirmModal(w); setProofUrl(''); }} disabled={actionLoading === w.id} title={lbl('Confirmar Pagamento', 'Confirm Payment', 'Confirmar Pago')}
                                  className="p-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/30 disabled:opacity-50">
                                  <DollarSign className="h-4 w-4" />
                                </button>
                                <button onClick={() => { setRejectModal(w); setRejectReason(''); }} disabled={actionLoading === w.id} title={lbl('Rejeitar', 'Reject', 'Rechazar')}
                                  className="p-1.5 bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/30 disabled:opacity-50">
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            {w.status === 'paid' && w.proof_url && (
                              <a href={w.proof_url} target="_blank" rel="noopener noreferrer" title={lbl('Ver Comprovante', 'View Receipt', 'Ver Comprobante')}
                                className="p-1.5 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">
                                <Download className="h-4 w-4" />
                              </a>
                            )}
                            {w.rejection_reason && (
                              <span className="text-xs text-red-500 dark:text-red-400 max-w-xs truncate" title={w.rejection_reason}>{w.rejection_reason}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && w.status === 'paid' && (
                        <tr>
                          <td colSpan={6} className="px-4 py-3 bg-gray-50 dark:bg-gray-700/20">
                            {loadingCommissions === w.id ? (
                              <div className="flex items-center justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
                              </div>
                            ) : commissions.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-3">
                                {lbl('Detalhe das vendas não disponível para saques anteriores ao rastreamento.', 'Sale details not available for pre-tracking withdrawals.', 'Detalles de ventas no disponibles para retiros anteriores al seguimiento.')}
                              </p>
                            ) : (
                              <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                    {lbl('Vendas inclusas neste saque', 'Sales included in this withdrawal', 'Ventas incluidas en este retiro')} ({commissions.length})
                                  </p>
                                </div>
                                <div className="divide-y divide-gray-200 dark:divide-gray-600">
                                  {commissions.map(c => (
                                    <div key={c.id} className="px-3 py-2.5 flex items-center gap-3">
                                      {c.product_image ? (
                                        <img src={c.product_image} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                                      ) : (
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                                          <Package className="h-4 w-4 text-blue-400" />
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.product_name || '—'}</p>
                                        <p className="text-xs text-gray-400">{c.customer_name} · x{c.order_quantity} · {formatDate(c.created_at)}</p>
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-semibold text-green-600 dark:text-green-400">{formatPrice(c.seller_amount)}</p>
                                        <p className="text-xs text-gray-400">{lbl('Venda:', 'Sale:', 'Venta:')} {formatPrice(c.total_amount)}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
                                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{lbl('Total do Saque', 'Withdrawal Total', 'Total del Retiro')}</span>
                                  <span className="text-sm font-bold text-gray-900 dark:text-white">{formatPrice(Number(w.amount))}</span>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700">
            <ChevronLeft className="h-4 w-4" />{lbl('Anterior', 'Previous', 'Anterior')}
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">{lbl('Página', 'Page', 'Página')} {page + 1}</span>
          <button onClick={() => setPage(page + 1)} disabled={!hasMore}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700">
            {lbl('Próximo', 'Next', 'Siguiente')}<ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{lbl('Rejeitar Saque', 'Reject Withdrawal', 'Rechazar Retiro')}</h3>
              <button onClick={() => setRejectModal(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{lbl('Valor: ', 'Amount: ', 'Monto: ')}<strong>{formatPrice(Number(rejectModal.amount))} {rejectModal.currency}</strong></p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{lbl('Motivo da Rejeição', 'Rejection Reason', 'Motivo del Rechazo')}</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                placeholder={lbl('Digite o motivo...', 'Enter the reason...', 'Ingrese el motivo...')} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">{lbl('Cancelar', 'Cancel', 'Cancelar')}</button>
              <button onClick={handleReject} disabled={!rejectReason.trim() || actionLoading === rejectModal.id}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md disabled:opacity-50">{lbl('Confirmar Rejeição', 'Confirm Rejection', 'Confirmar Rechazo')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Payment Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{lbl('Confirmar Pagamento', 'Confirm Payment', 'Confirmar Pago')}</h3>
              <button onClick={() => setConfirmModal(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{lbl('Valor: ', 'Amount: ', 'Monto: ')}<strong>{formatPrice(Number(confirmModal.amount))} {confirmModal.currency}</strong></p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{lbl('URL do Comprovante (opcional)', 'Receipt URL (optional)', 'URL del Comprobante (opcional)')}</label>
              <input type="text" value={proofUrl} onChange={e => setProofUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200" placeholder="https://..." />
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                {lbl('Ao confirmar, as comissões correspondentes serão marcadas como pagas e o vendedor será notificado.', 'By confirming, corresponding commissions will be marked as paid and the seller will be notified.', 'Al confirmar, las comisiones correspondientes serán marcadas como pagadas y el vendedor será notificado.')}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">{lbl('Cancelar', 'Cancel', 'Cancelar')}</button>
              <button onClick={handleConfirmPayment} disabled={actionLoading === confirmModal.id}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md disabled:opacity-50">{lbl('Confirmar Pagamento', 'Confirm Payment', 'Confirmar Pago')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
