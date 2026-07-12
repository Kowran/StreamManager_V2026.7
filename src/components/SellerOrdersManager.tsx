import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Calendar, Package, Download, Eye, Truck, CheckCircle,
  Clock, X, MessageCircle, User, DollarSign, ShoppingCart
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useCurrency } from './CurrencyProvider';
import { useLanguage } from './LanguageProvider';

interface SellerOrder {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  total_usdt: number;
  total_brl: number;
  status: string;
  customer_email: string;
  customer_name: string;
  created_at: string;
  updated_at: string;
  delivered_accounts?: { email: string; password: string; instructions?: string }[];
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
    applyFilters();
  }, [orders, searchTerm, statusFilter, dateFilter]);

  async function loadOrders() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('store_orders')
        .select(`
          id, product_id, quantity, total_usdt, total_brl, status,
          customer_email, customer_name, created_at, updated_at,
          store_products (name)
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(o => ({
        id: o.id,
        product_id: o.product_id,
        product_name: (o.store_products as any)?.name || 'Unknown',
        quantity: o.quantity,
        total_usdt: o.total_usdt || 0,
        total_brl: o.total_brl || 0,
        status: o.status,
        customer_email: o.customer_email || '',
        customer_name: o.customer_name || '',
        created_at: o.created_at,
        updated_at: o.updated_at,
      }));
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
        o.customer_email.toLowerCase().includes(term) ||
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

  function exportToCSV() {
    const headers = ['ID', 'Data', 'Produto', 'Cliente', 'Email', 'Qtd', 'Valor (USD)', 'Status'];
    const rows = filteredOrders.map(o => [
      o.id, formatDate(o.created_at), o.product_name, o.customer_name,
      o.customer_email, o.quantity.toString(), o.total_usdt.toFixed(2), o.status,
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
                      <span className="truncate max-w-[120px]">{order.product_name}</span>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-3 py-3 text-sm text-gray-900 dark:text-white">
                    <div>{order.customer_name}</div>
                    <div className="text-xs text-gray-500">{order.customer_email}</div>
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
              <DetailRow icon={User} label={lbl('Cliente', 'Customer', 'Cliente')} value={selectedOrder.customer_name} />
              <DetailRow icon={Clock} label={lbl('Email', 'Email', 'Email')} value={selectedOrder.customer_email} />
              <DetailRow icon={Calendar} label={lbl('Data', 'Date', 'Fecha')} value={formatDate(selectedOrder.created_at)} />
              <DetailRow icon={DollarSign} label={lbl('Valor', 'Amount', 'Valor')} value={formatPrice(selectedOrder.total_usdt)} />
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">{lbl('Status', 'Status', 'Estado')}</span>
                {getStatusBadge(selectedOrder.status)}
              </div>
              <div className="flex items-center justify-between py-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">{lbl('Quantidade', 'Quantity', 'Cantidad')}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{selectedOrder.quantity}</span>
              </div>
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
