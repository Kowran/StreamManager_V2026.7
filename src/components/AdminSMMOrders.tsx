import React, { useState, useEffect } from 'react';
import { ShoppingCart, Search, Filter, Calendar, User, Link as LinkIcon, TrendingUp, CheckCircle, Clock, XCircle, AlertTriangle, RefreshCw, CreditCard as Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';

interface SMMOrder {
  id: string;
  order_number: string;
  user_id: string;
  service_id: string;
  provider_order_id: string;
  link: string;
  quantity: number;
  charge: number;
  start_count: number;
  remains: number;
  status: 'pending' | 'processing' | 'completed' | 'partial' | 'cancelled' | 'failed';
  created_at: string;
  updated_at: string;
  user_email?: string;
  service_name?: string;
  category?: string;
}

export function AdminSMMOrders() {
  const { language } = useLanguage();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<SMMOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingOrder, setEditingOrder] = useState<SMMOrder | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);
      const { data: ordersData, error } = await supabase
        .from('smm_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedOrders = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', order.user_id)
            .maybeSingle();

          const { data: service } = await supabase
            .from('smm_services')
            .select('name, category')
            .eq('id', order.service_id)
            .maybeSingle();

          return {
            ...order,
            user_email: profile?.email || 'N/A',
            service_name: service?.name || 'N/A',
            category: service?.category || 'N/A'
          };
        })
      );

      setOrders(formattedOrders);
    } catch (error) {
      console.error('Error loading SMM orders:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateStatus(orderId: string, newStatus: string, startCount?: number, remains?: number) {
    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (startCount !== undefined) updateData.start_count = startCount;
      if (remains !== undefined) updateData.remains = remains;

      const { error } = await supabase
        .from('smm_orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      alert(language === 'pt' ? 'Status atualizado com sucesso!' : language === 'en' ? 'Status updated successfully!' : 'Estado actualizado con éxito!');
      setEditingOrder(null);
      loadOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
      alert(language === 'pt' ? 'Erro ao atualizar status' : language === 'en' ? 'Error updating status' : 'Error al actualizar estado');
    }
  }

  async function handleCancelOrder(orderId: string, userId: string, charge: number) {
    try {
      const { error: orderError } = await supabase
        .from('smm_orders')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      const { error: creditError } = await supabase.rpc('credit_user_account', {
        p_user_id: userId,
        p_amount: charge,
        p_type: 'refund',
        p_description: `Reembolso - Pedido SMM cancelado`,
        p_reference_type: 'smm_refund',
        p_reference_id: orderId
      });

      if (creditError) {
        console.error('Error refunding credits:', creditError);
      }

      alert(language === 'pt' ? 'Pedido cancelado e créditos reembolsados!' : language === 'en' ? 'Order cancelled and credits refunded!' : 'Pedido cancelado y créditos reembolsados!');
      setShowCancelConfirm(null);
      loadOrders();
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert(language === 'pt' ? 'Erro ao cancelar pedido' : language === 'en' ? 'Error cancelling order' : 'Error al cancelar pedido');
    }
  }

  const getStatusBadge = (status: string) => {
    const configs = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: language === 'pt' ? 'Pendente' : language === 'en' ? 'Pending' : 'Pendiente' },
      processing: { color: 'bg-blue-100 text-blue-800', icon: RefreshCw, label: language === 'pt' ? 'Processando' : language === 'en' ? 'Processing' : 'Procesando' },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: language === 'pt' ? 'Completo' : language === 'en' ? 'Completed' : 'Completado' },
      partial: { color: 'bg-orange-100 text-orange-800', icon: AlertTriangle, label: language === 'pt' ? 'Parcial' : language === 'en' ? 'Partial' : 'Parcial' },
      cancelled: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: language === 'pt' ? 'Cancelado' : language === 'en' ? 'Cancelled' : 'Cancelado' },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircle, label: language === 'pt' ? 'Falhou' : language === 'en' ? 'Failed' : 'Fallido' }
    };

    const config = configs[status as keyof typeof configs] || configs.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch =
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.service_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.link?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'pt' ? 'Pedidos SMM' : language === 'en' ? 'SMM Orders' : 'Pedidos SMM'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {language === 'pt' ? 'Visualize e gerencie todos os pedidos SMM dos usuários' : language === 'en' ? 'View and manage all user SMM orders' : 'Ver y gestionar todos los pedidos SMM de usuarios'}
          </p>
        </div>
        <button
          onClick={loadOrders}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {language === 'pt' ? 'Atualizar' : language === 'en' ? 'Refresh' : 'Actualizar'}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder={language === 'pt' ? 'Buscar por pedido, email, serviço...' : language === 'en' ? 'Search by order, email, service...' : 'Buscar por pedido, email, servicio...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400 w-5 h-5" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{language === 'pt' ? 'Todos' : language === 'en' ? 'All' : 'Todos'}</option>
              <option value="pending">{language === 'pt' ? 'Pendente' : language === 'en' ? 'Pending' : 'Pendiente'}</option>
              <option value="processing">{language === 'pt' ? 'Processando' : language === 'en' ? 'Processing' : 'Procesando'}</option>
              <option value="completed">{language === 'pt' ? 'Completo' : language === 'en' ? 'Completed' : 'Completado'}</option>
              <option value="partial">{language === 'pt' ? 'Parcial' : language === 'en' ? 'Partial' : 'Parcial'}</option>
              <option value="cancelled">{language === 'pt' ? 'Cancelado' : language === 'en' ? 'Cancelled' : 'Cancelado'}</option>
              <option value="failed">{language === 'pt' ? 'Falhou' : language === 'en' ? 'Failed' : 'Fallido'}</option>
            </select>
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {language === 'pt' ? 'Nenhum pedido encontrado' : language === 'en' ? 'No orders found' : 'No se encontraron pedidos'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {language === 'pt' ? 'Pedido' : language === 'en' ? 'Order' : 'Pedido'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {language === 'pt' ? 'Usuário' : language === 'en' ? 'User' : 'Usuario'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {language === 'pt' ? 'Serviço' : language === 'en' ? 'Service' : 'Servicio'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {language === 'pt' ? 'Link' : language === 'en' ? 'Link' : 'Enlace'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {language === 'pt' ? 'Quantidade' : language === 'en' ? 'Quantity' : 'Cantidad'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {language === 'pt' ? 'Valor' : language === 'en' ? 'Amount' : 'Monto'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {language === 'pt' ? 'Data' : language === 'en' ? 'Date' : 'Fecha'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {language === 'pt' ? 'Ações' : language === 'en' ? 'Actions' : 'Acciones'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <ShoppingCart className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {order.order_number || order.id.slice(0, 8)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {order.user_email}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {order.service_name}
                        </div>
                        {order.category && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {order.category}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center max-w-xs">
                        <LinkIcon className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                        <a
                          href={order.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 truncate"
                        >
                          {order.link}
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <TrendingUp className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {order.quantity.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatPrice(Number(order.charge))}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {new Date(order.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingOrder(order)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title={language === 'pt' ? 'Editar status' : language === 'en' ? 'Edit status' : 'Editar estado'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {order.status !== 'cancelled' && order.status !== 'completed' && (
                          <button
                            onClick={() => setShowCancelConfirm(order.id)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title={language === 'pt' ? 'Cancelar pedido' : language === 'en' ? 'Cancel order' : 'Cancelar pedido'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {language === 'pt' ? `Total: ${filteredOrders.length} pedidos` : language === 'en' ? `Total: ${filteredOrders.length} orders` : `Total: ${filteredOrders.length} pedidos`}
          </div>
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {language === 'pt' ? 'Valor Total:' : language === 'en' ? 'Total Amount:' : 'Monto Total:'} {formatPrice(filteredOrders.reduce((sum, order) => sum + Number(order.charge), 0))}
          </div>
        </div>
      </div>

      {editingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {language === 'pt' ? 'Atualizar Status do Pedido' : language === 'en' ? 'Update Order Status' : 'Actualizar Estado del Pedido'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={editingOrder.status}
                  onChange={(e) => setEditingOrder({ ...editingOrder, status: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">{language === 'pt' ? 'Pendente' : language === 'en' ? 'Pending' : 'Pendiente'}</option>
                  <option value="processing">{language === 'pt' ? 'Processando' : language === 'en' ? 'Processing' : 'Procesando'}</option>
                  <option value="completed">{language === 'pt' ? 'Completo' : language === 'en' ? 'Completed' : 'Completado'}</option>
                  <option value="partial">{language === 'pt' ? 'Parcial' : language === 'en' ? 'Partial' : 'Parcial'}</option>
                  <option value="cancelled">{language === 'pt' ? 'Cancelado' : language === 'en' ? 'Cancelled' : 'Cancelado'}</option>
                  <option value="failed">{language === 'pt' ? 'Falhou' : language === 'en' ? 'Failed' : 'Fallido'}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Contagem Inicial' : language === 'en' ? 'Start Count' : 'Conteo Inicial'}
                </label>
                <input
                  type="number"
                  value={editingOrder.start_count || 0}
                  onChange={(e) => setEditingOrder({ ...editingOrder, start_count: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {language === 'pt' ? 'Restante' : language === 'en' ? 'Remains' : 'Restante'}
                </label>
                <input
                  type="number"
                  value={editingOrder.remains || 0}
                  onChange={(e) => setEditingOrder({ ...editingOrder, remains: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setEditingOrder(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {language === 'pt' ? 'Cancelar' : language === 'en' ? 'Cancel' : 'Cancelar'}
                </button>
                <button
                  onClick={() => handleUpdateStatus(editingOrder.id, editingOrder.status, editingOrder.start_count, editingOrder.remains)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {language === 'pt' ? 'Salvar' : language === 'en' ? 'Save' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {language === 'pt' ? 'Confirmar Cancelamento' : language === 'en' ? 'Confirm Cancellation' : 'Confirmar Cancelación'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {language === 'pt'
                ? 'Tem certeza que deseja cancelar este pedido? Os créditos serão reembolsados ao usuário.'
                : language === 'en'
                ? 'Are you sure you want to cancel this order? Credits will be refunded to the user.'
                : '¿Estás seguro de que deseas cancelar este pedido? Los créditos serán reembolsados al usuario.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {language === 'pt' ? 'Não' : language === 'en' ? 'No' : 'No'}
              </button>
              <button
                onClick={() => {
                  const order = orders.find(o => o.id === showCancelConfirm);
                  if (order) handleCancelOrder(order.id, order.user_id, order.charge);
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                {language === 'pt' ? 'Sim, Cancelar' : language === 'en' ? 'Yes, Cancel' : 'Sí, Cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
