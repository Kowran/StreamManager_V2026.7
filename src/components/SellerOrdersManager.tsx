import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Calendar, Package, Download, Eye, Truck, CheckCircle,
  Clock, X, MessageCircle, User, DollarSign, ShoppingCart, ShieldAlert, AlertTriangle,
  CreditCard, ExternalLink, Layers
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useCurrency } from './CurrencyProvider';
import { useLanguage } from './LanguageProvider';

interface SellerOrder {
  id: string;
  product_id: string;
  product_name: string;
  variation_name?: string | null;
  quantity: number;
  total_usdt: number;
  total_brl: number;
  status: string;
  customer_name: string;
  created_at: string;
  updated_at: string;
  delivered_accounts?: { email: string; password: string; instructions?: string }[];
  delivered_at?: string;
  test_days_left?: number;
  seller_amount?: number | null;
  admin_amount?: number | null;
  admin_rate?: number | null;
  seller_rate?: number | null;
}

export function SellerOrdersManager() {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { language } = useLanguage();
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<SellerOrder | null>(null);
  const [orderCommission, setOrderCommission] = useState<{ seller_amount: number; admin_amount: number; admin_rate: number; seller_rate: number } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const lbl = useCallback((pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es, [language]);

  useEffect(() => {
    loadOrders();
    if (user) {
      const channel = supabase
        .channel(`seller-orders:${user.id}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'store_orders', filter: `seller_id=eq.${user.id}` },
          () => loadOrders()
        )
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  useEffect(() => {
    function handleOpenOrderDetail(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (!detail?.orderId) return;
      const order = orders.find(o => o.id === detail.orderId);
      if (order) {
        setSelectedOrder(order);
      } else {
        supabase
          .from('seller_orders_view')
          .select(`id, product_id, quantity, total_usdt, total_brl, status, customer_name, delivered_at, created_at, updated_at, store_products (name), store_deliveries (delivery_content, delivery_method, delivery_status, delivered_at)`)
          .eq('id', detail.orderId)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              const o = data as any;
              const deliveredAccounts = (o.store_deliveries || [])
                .filter((d: any) => d.delivery_content)
                .flatMap((d: any) => {
                  try { return JSON.parse(d.delivery_content); } catch { return []; }
                });
              setSelectedOrder({
                ...o,
                product_name: o.store_products?.name || '',
                delivered_accounts: deliveredAccounts,
                delivered_at: o.delivered_at || o.store_deliveries?.[0]?.delivered_at,
              } as SellerOrder);
            }
          });
      }
    }
    window.addEventListener('open-order-detail', handleOpenOrderDetail);
    return () => window.removeEventListener('open-order-detail', handleOpenOrderDetail);
  }, [orders]);

  useEffect(() => {
    applyFilters();
  }, [orders, searchTerm, statusFilter, dateFilter]);

  async function loadOrders() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('seller_orders_view')
        .select(`
          id, product_id, quantity, total_usdt, total_brl, status,
          customer_name, delivered_at, created_at, updated_at,
          store_products (name),
          store_deliveries (delivery_content, delivery_method, delivery_status, delivered_at)
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch commission data for all orders
      const orderIds = (data || []).map((o: any) => o.id);
      const commissionMap: Record<string, any> = {};
      if (orderIds.length > 0) {
        const { data: commissions } = await supabase
          .from('sales_commissions')
          .select('order_id, seller_amount, admin_amount, admin_commission_rate, seller_commission_rate, currency')
          .eq('seller_id', user.id)
          .in('order_id', orderIds)
          .eq('currency', 'USDT');
        (commissions || []).forEach((c: any) => {
          commissionMap[c.order_id] = c;
        });
      }

      const mapped = (data || []).map((o: any) => {
        const accounts: { email: string; password: string; instructions?: string }[] = [];
        (o.store_deliveries || []).forEach((d: any) => {
          const content = d.delivery_content;
          if (content) {
            if (Array.isArray(content.accounts)) {
              content.accounts.forEach((a: any) => accounts.push({ email: a.email || '', password: a.password || '', instructions: a.instructions }));
            } else if (content.email) {
              accounts.push({ email: content.email, password: content.password || '', instructions: content.instructions });
            }
          }
        });
        const purchaseDate = new Date(o.created_at);
        const testEnd = new Date(purchaseDate.getTime() + 3 * 24 * 60 * 60 * 1000);
        const daysLeft = Math.max(0, Math.ceil((testEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        return {
          id: o.id,
          product_id: o.product_id,
          product_name: (o.store_products as any)?.name || 'Unknown',
          variation_name: (o as any).variation_name || null,
          quantity: o.quantity,
          total_usdt: o.total_usdt || 0,
          total_brl: o.total_brl || 0,
          status: o.status,
          customer_name: o.customer_name || '',
          delivered_at: o.delivered_at,
          test_days_left: daysLeft,
          delivered_accounts: accounts,
          created_at: o.created_at,
          updated_at: o.updated_at,
          seller_amount: commissionMap[o.id]?.seller_amount ?? null,
          admin_amount: commissionMap[o.id]?.admin_amount ?? null,
          admin_rate: commissionMap[o.id]?.admin_commission_rate ?? null,
          seller_rate: commissionMap[o.id]?.seller_commission_rate ?? null,
        };
      });
      setOrders(mapped);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...orders];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(o =>
        o.product_name.toLowerCase().includes(term) ||
        o.customer_name.toLowerCase().includes(term) ||
        o.id.toLowerCase().includes(term)
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === statusFilter);
    }
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      switch (dateFilter) {
        case 'today': filterDate.setHours(0, 0, 0, 0); break;
        case 'week': filterDate.setDate(now.getDate() - 7); break;
        case 'month': filterDate.setMonth(now.getMonth() - 1); break;
      }
      filtered = filtered.filter(o => new Date(o.created_at) >= filterDate);
    }
    setFilteredOrders(filtered);
  }

  async function updateOrderStatus(orderId: string, newStatus: string) {
    if (newStatus === 'cancelled') {
      await handleSellerCancel(orderId);
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('store_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('seller_id', user?.id);
      if (error) throw error;
      await loadOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error) {
      console.error('Error updating order:', error);
      alert(lbl('Erro ao atualizar pedido', 'Error updating order', 'Error al actualizar pedido'));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSellerCancel(orderId: string) {
    const reason = prompt(lbl(
      'Digite o motivo do cancelamento:',
      'Enter the cancellation reason:',
      'Ingrese el motivo de cancelación:'
    ));
    if (!reason || !reason.trim()) return;

    const returnToStock = confirm(lbl(
      'Devolver o item ao estoque?',
      'Return item to stock?',
      '¿Devolver el item al inventario?'
    ));

    setActionLoading(true);
    try {
      const { data, error } = await supabase.rpc('process_seller_cancellation', {
        p_order_id: orderId,
        p_cancellation_reason: reason.trim(),
        p_return_to_stock: returnToStock,
      });
      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error || 'Unknown error');
      }
      await loadOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: 'cancelled' } : null);
      }
      alert(lbl(
        'Pedido cancelado e cliente reembolsado com sucesso.',
        'Order cancelled and customer refunded successfully.',
        'Pedido cancelado y cliente reembolsado con éxito.'
      ));
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert(lbl(
        'Erro ao cancelar pedido: ' + (error instanceof Error ? error.message : ''),
        'Error cancelling order: ' + (error instanceof Error ? error.message : ''),
        'Error al cancelar pedido: ' + (error instanceof Error ? error.message : '')
      ));
    } finally {
      setActionLoading(false);
    }
  }

  function exportToCSV() {
    const headers = ['ID', 'Data', 'Produto', 'Cliente', 'Email', 'Qtd', 'Valor (USD)', 'Status'];
    const rows = filteredOrders.map(o => [
      o.id, formatDate(o.created_at), o.product_name, o.customer_name,
      o.quantity.toString(), o.total_usdt.toFixed(2), o.status,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function getStatusBadge(status: string) {
    const config: Record<string, { color: string; label: string }> = {
      pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400', label: lbl('Pendente', 'Pending', 'Pendiente') },
      processing: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400', label: lbl('Processando', 'Processing', 'Procesando') },
      paid: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400', label: lbl('Pago', 'Paid', 'Pagado') },
      delivered: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400', label: lbl('Entregue', 'Delivered', 'Entregado') },
      completed: { color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400', label: lbl('Concluído', 'Completed', 'Completado') },
      cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400', label: lbl('Cancelado', 'Cancelled', 'Cancelado') },
      refunded: { color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400', label: lbl('Reembolsado', 'Refunded', 'Reembolsado') },
      disputed: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400', label: lbl('Disputa Aberta', 'Disputed', 'Disputa Abierta') },
    };
    const c = config[status] || config.pending;
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}>{c.label}</span>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={lbl('Buscar por produto, cliente, email...', 'Search by product, customer, email...', 'Buscar por producto, cliente, email...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500">
            <option value="all">{lbl('Todos os status', 'All status', 'Todos los estados')}</option>
            <option value="pending">{lbl('Pendente', 'Pending', 'Pendiente')}</option>
            <option value="paid">{lbl('Pago', 'Paid', 'Pagado')}</option>
            <option value="delivered">{lbl('Entregue', 'Delivered', 'Entregado')}</option>
            <option value="completed">{lbl('Concluído', 'Completed', 'Completado')}</option>
            <option value="cancelled">{lbl('Cancelado', 'Cancelled', 'Cancelado')}</option>
            <option value="disputed">{lbl('Disputa', 'Disputed', 'Disputa')}</option>
          </select>
          <div className="flex gap-2">
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500">
              <option value="all">{lbl('Todo período', 'All time', 'Todo el período')}</option>
              <option value="today">{lbl('Hoje', 'Today', 'Hoy')}</option>
              <option value="week">{lbl('Semana', 'Week', 'Semana')}</option>
              <option value="month">{lbl('Mês', 'Month', 'Mes')}</option>
            </select>
            <button onClick={exportToCSV} disabled={filteredOrders.length === 0}
              className="px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{lbl('Data', 'Date', 'Fecha')}</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{lbl('Produto', 'Product', 'Producto')}</th>
                <th className="hidden md:table-cell px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{lbl('Cliente', 'Customer', 'Cliente')}</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{lbl('Qtd', 'Qty', 'Cant')}</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{lbl('Valor', 'Amount', 'Valor')}</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{lbl('Status', 'Status', 'Estado')}</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{lbl('Ações', 'Actions', 'Acciones')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-3 py-3 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-gray-400" />
                      {formatDate(order.created_at)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    <div className="flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 text-gray-400" />
                      <div className="min-w-0">
                        <span className="truncate max-w-[120px] block">{order.product_name}</span>
                        {order.variation_name && (
                          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium truncate block">{order.variation_name}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-3 py-3 text-sm text-gray-900 dark:text-white">
                    <div>{order.customer_name}</div>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-900 dark:text-white">{order.quantity}</td>
                  <td className="px-3 py-3 text-sm font-semibold text-green-600 dark:text-green-400">{formatPrice(order.total_usdt)}</td>
                  <td className="px-3 py-3">{getStatusBadge(order.status)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSelectedOrder(order)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors" title={lbl('Detalhes', 'Details', 'Detalles')}>
                        <Eye className="h-4 w-4" />
                      </button>
                      {(order.status === 'paid' || order.status === 'processing') && (
                        <button onClick={() => updateOrderStatus(order.id, 'delivered')}
                          disabled={actionLoading}
                          className="p-1.5 text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-md transition-colors disabled:opacity-50" title={lbl('Marcar entregue', 'Mark delivered', 'Marcar entregado')}>
                          <Truck className="h-4 w-4" />
                        </button>
                      )}
                      {order.status === 'delivered' && (
                        <button onClick={() => updateOrderStatus(order.id, 'completed')}
                          disabled={actionLoading}
                          className="p-1.5 text-green-600 hover:text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors disabled:opacity-50" title={lbl('Concluir', 'Complete', 'Completar')}>
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <ShoppingCart className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {orders.length === 0 ? lbl('Nenhum pedido ainda', 'No orders yet', 'Sin pedidos aún') : lbl('Nenhum pedido encontrado', 'No orders found', 'Sin pedidos encontrados')}
            </p>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {lbl('Detalhes do Pedido', 'Order Details', 'Detalles del Pedido')}
              </h3>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <DetailRow icon={Package} label={lbl('Produto', 'Product', 'Producto')} value={selectedOrder.product_name} />
              {selectedOrder.variation_name && (
                <DetailRow icon={Layers} label={lbl('Variação', 'Variation', 'Variación')} value={selectedOrder.variation_name} />
              )}
              <DetailRow icon={User} label={lbl('Cliente', 'Customer', 'Cliente')} value={selectedOrder.customer_name} />
              <DetailRow icon={Calendar} label={lbl('Data', 'Date', 'Fecha')} value={formatDate(selectedOrder.created_at)} />
              <DetailRow icon={DollarSign} label={lbl('Valor Total', 'Total Amount', 'Valor Total')} value={formatPrice(selectedOrder.total_usdt)} />
              {selectedOrder.seller_amount != null && selectedOrder.admin_amount != null ? (
                <>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <span className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                      <DollarSign className="h-4 w-4" />
                      {lbl('Seu Lucro', 'Your Profit', 'Tu Ganancia')} ({selectedOrder.seller_rate}%)
                    </span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">{formatPrice(selectedOrder.seller_amount)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <span className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400">
                      <ShieldAlert className="h-4 w-4" />
                      {lbl('Taxa da Plataforma', 'Platform Fee', 'Comisión Plataforma')} ({selectedOrder.admin_rate}%)
                    </span>
                    <span className="text-sm font-bold text-red-500 dark:text-red-400">{formatPrice(selectedOrder.admin_amount)}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <span className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400">
                    <Clock className="h-4 w-4" />
                    {lbl('Comissão será calculada ao concluir', 'Commission calculated on completion', 'Comisión calculada al completar')}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">{lbl('Status', 'Status', 'Estado')}</span>
                {getStatusBadge(selectedOrder.status)}
              </div>
              <div className="flex items-center justify-between py-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">{lbl('Quantidade', 'Quantity', 'Cantidad')}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{selectedOrder.quantity}</span>
              </div>

              {/* Test Period Indicator */}
              {!['cancelled', 'refunded', 'completed'].includes(selectedOrder.status) && (
                <div className="flex items-center justify-between py-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="h-4 w-4 text-gray-400" />
                    {lbl('Período de Teste', 'Test Period', 'Período de Prueba')}
                  </span>
                  <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                    (selectedOrder.test_days_left || 0) > 0
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {(selectedOrder.test_days_left || 0) > 0
                      ? lbl(`${selectedOrder.test_days_left}d restante${(selectedOrder.test_days_left || 0) > 1 ? 's' : ''}`, `${selectedOrder.test_days_left}d left`, `${selectedOrder.test_days_left}d restante${(selectedOrder.test_days_left || 0) > 1 ? 's' : ''}`)
                      : lbl('Encerrado', 'Ended', 'Terminado')}
                  </span>
                </div>
              )}

              {/* Delivered Accounts */}
              {selectedOrder.delivered_accounts && selectedOrder.delivered_accounts.length > 0 && (
                <div className="py-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <CreditCard className="h-4 w-4 text-gray-400" />
                    {lbl('Contas Entregues', 'Delivered Accounts', 'Cuentas Entregadas')}
                    <span className="text-xs text-gray-500 dark:text-gray-400">({selectedOrder.delivered_accounts.length})</span>
                  </span>
                  <div className="space-y-1.5">
                    {selectedOrder.delivered_accounts.map((acct, idx) => (
                      <div key={idx} className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-gray-700 dark:text-gray-300">{acct.email}</span>
                          <span className="font-mono text-gray-500 dark:text-gray-400 ml-2">{acct.password}</span>
                        </div>
                        {acct.instructions && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{acct.instructions}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-2">
              {(selectedOrder.status === 'paid' || selectedOrder.status === 'processing') && (
                <button onClick={() => updateOrderStatus(selectedOrder.id, 'delivered')}
                  disabled={actionLoading}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  <Truck className="h-4 w-4" />
                  {lbl('Marcar Entregue', 'Mark Delivered', 'Marcar Entregado')}
                </button>
              )}
              {selectedOrder.status === 'delivered' && (
                <button onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}
                  disabled={actionLoading}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {lbl('Concluir Pedido', 'Complete Order', 'Completar Pedido')}
                </button>
              )}
              {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'completed' && selectedOrder.status !== 'refunded' && (
                <button onClick={() => {
                  if (confirm(lbl('Cancelar este pedido?', 'Cancel this order?', '¿Cancelar este pedido?'))) {
                    updateOrderStatus(selectedOrder.id, 'cancelled');
                  }
                }}
                  disabled={actionLoading}
                  className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50">
                  {lbl('Cancelar', 'Cancel', 'Cancelar')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <Icon className="h-4 w-4 text-gray-400" />
        {label}
      </span>
      <span className="text-sm font-medium text-gray-900 dark:text-white text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}
