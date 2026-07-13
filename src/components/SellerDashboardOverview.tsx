import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, ShoppingCart, Package, TrendingUp, TrendingDown,
  Clock, CheckCircle, XCircle, ArrowUpRight, ArrowDownRight,
  Star, Users, AlertTriangle, Eye, Wallet, Lock, Snowflake, Download, X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useCurrency } from './CurrencyProvider';
import { useLanguage } from './LanguageProvider';

interface SaleRecord {
  id: string;
  product_name: string;
  total_usdt: number;
  status: string;
  created_at: string;
  customer_name: string;
  quantity: number;
}

interface ProductStat {
  id: string;
  name: string;
  total_sales: number;
  revenue: number;
  stock: number;
  active: boolean;
}

interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  totalProducts: number;
  activeProducts: number;
  totalStock: number;
  lowStockProducts: number;
  avgOrderValue: number;
  conversionRate: number;
}

export function SellerDashboardOverview({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { t, language } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<SaleRecord[]>([]);
  const [topProducts, setTopProducts] = useState<ProductStat[]>([]);
  const [revenueData, setRevenueData] = useState<{ day: string; revenue: number; orders: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawableBalance, setWithdrawableBalance] = useState(0);
  const [holdBalance, setHoldBalance] = useState(0);
  const [frozenBalance, setFrozenBalance] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const lbl = useCallback((pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es, [language]);

  useEffect(() => {
    if (user) loadDashboardData();
  }, [user]);

  async function loadDashboardData() {
    if (!user) return;
    setLoading(true);

    try {
      const [ordersRes, productsRes, inventoryRes] = await Promise.all([
        supabase
          .from('store_orders')
          .select(`
            id, product_id, quantity, total_usdt, total_brl, status, created_at,
            customer_name, store_products (name)
          `)
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('store_products')
          .select('id, name, stock_quantity, active, price_usdt')
          .eq('seller_id', user.id),
        supabase
          .from('product_inventory')
          .select('product_id, status')
          .in('product_id', (await supabase.from('store_products').select('id').eq('seller_id', user.id)).data?.map(p => p.id) || [])
      ]);

      const orders = ordersRes.data || [];
      const products = productsRes.data || [];

      const completed = orders.filter(o => o.status === 'completed');
      const pending = orders.filter(o => ['pending', 'processing', 'paid', 'delivered'].includes(o.status));
      const cancelled = orders.filter(o => ['cancelled', 'refunded'].includes(o.status));
      const totalRevenue = completed.reduce((sum, o) => sum + (o.total_usdt || 0), 0);

      const activeProducts = products.filter(p => p.active);
      const lowStock = products.filter(p => p.stock_quantity <= 2 && p.active);

      setStats({
        totalRevenue,
        totalOrders: orders.length,
        completedOrders: completed.length,
        pendingOrders: pending.length,
        cancelledOrders: cancelled.length,
        totalProducts: products.length,
        activeProducts: activeProducts.length,
        totalStock: products.reduce((sum, p) => sum + (p.stock_quantity || 0), 0),
        lowStockProducts: lowStock.length,
        avgOrderValue: completed.length > 0 ? totalRevenue / completed.length : 0,
        conversionRate: orders.length > 0 ? (completed.length / orders.length) * 100 : 0,
      });

      setRecentSales(orders.slice(0, 8).map(o => ({
        id: o.id,
        product_name: (o.store_products as any)?.name || 'Unknown',
        total_usdt: o.total_usdt || 0,
        status: o.status,
        created_at: o.created_at,
        customer_name: o.customer_name || 'N/A',
        quantity: o.quantity || 1,
      })));

      const productMap: Record<string, ProductStat> = {};
      for (const p of products) {
        productMap[p.id] = {
          id: p.id, name: p.name, total_sales: 0, revenue: 0,
          stock: p.stock_quantity || 0, active: p.active,
        };
      }
      for (const o of completed) {
        if (productMap[o.product_id]) {
          productMap[o.product_id].total_sales += o.quantity || 1;
          productMap[o.product_id].revenue += o.total_usdt || 0;
        }
      }
      setTopProducts(Object.values(productMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5));

      // Revenue chart for last 7 days
      const days: { day: string; revenue: number; orders: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);

        const dayOrders = orders.filter(o => {
          const od = new Date(o.created_at);
          return od >= date && od < nextDay;
        });
        const dayRevenue = dayOrders.filter(o => o.status === 'completed')
          .reduce((sum, o) => sum + (o.total_usdt || 0), 0);

        days.push({
          day: date.toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { weekday: 'short' }),
          revenue: dayRevenue,
          orders: dayOrders.length,
        });
      }
      setRevenueData(days);

      // Load withdrawal balances
      const [wBal, hBal, fBal] = await Promise.all([
        supabase.rpc('get_seller_withdrawable_balance', { p_seller_id: user?.id, p_currency: 'USDT' }),
        supabase.rpc('get_seller_pending_hold_balance', { p_seller_id: user?.id, p_currency: 'USDT' }),
        supabase.rpc('get_seller_frozen_balance', { p_seller_id: user?.id, p_currency: 'USDT' }),
      ]);
      if (wBal.data !== null) setWithdrawableBalance(Number(wBal.data));
      if (hBal.data !== null) setHoldBalance(Number(hBal.data));
      if (fBal.data !== null) setFrozenBalance(Number(fBal.data));

      // Load withdrawal history
      const { data: wData } = await supabase
        .from('seller_withdrawal_requests')
        .select('*')
        .eq('seller_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (wData) {
        setWithdrawals(wData);
        setTotalWithdrawn(wData.filter(w => w.status === 'paid').reduce((sum, w) => sum + Number(w.amount), 0));
      }

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
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

  async function handleRequestWithdrawal() {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      alert(lbl('Digite um valor válido', 'Enter a valid amount', 'Ingrese un monto válido'));
      return;
    }
    setWithdrawLoading(true);
    try {
      const { data, error } = await supabase.rpc('request_seller_withdrawal', {
        p_amount: amount,
        p_currency: 'USDT',
        p_payment_method: {} as any,
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error);
      alert(lbl('Pedido de saque criado! Aguardando aprovação do administrador.', 'Withdrawal request created! Awaiting admin approval.', '¡Solicitud de retiro creada! Esperando aprobación del administrador.'));
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      loadDashboardData();
    } catch (error) {
      alert(lbl('Erro: ', 'Error: ', 'Error: ') + (error instanceof Error ? error.message : ''));
    } finally {
      setWithdrawLoading(false);
    }
  }

  if (!stats) return null;

  const maxRevenue = Math.max(...revenueData.map(d => d.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          icon={DollarSign}
          label={lbl('Receita Total', 'Total Revenue', 'Ingresos Totales')}
          value={formatPrice(stats.totalRevenue)}
          color="emerald"
          trend={stats.completedOrders > 0 ? '+up' : undefined}
        />
        <StatCard
          icon={ShoppingCart}
          label={lbl('Pedidos', 'Orders', 'Pedidos')}
          value={stats.totalOrders.toString()}
          color="blue"
          subValue={`${stats.completedOrders} ${lbl('concluídos', 'completed', 'completados')}`}
        />
        <StatCard
          icon={Package}
          label={lbl('Produtos', 'Products', 'Productos')}
          value={stats.totalProducts.toString()}
          color="indigo"
          subValue={`${stats.activeProducts} ${lbl('ativos', 'active', 'activos')}`}
        />
        <StatCard
          icon={TrendingUp}
          label={lbl('Ticket Médio', 'Avg Order', 'Pedido Promedio')}
          value={formatPrice(stats.avgOrderValue)}
          color="amber"
        />
      </div>

      {/* Withdrawal Balance Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-lg border border-green-200 dark:border-green-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">{lbl('Disponível para Saque', 'Available for Withdrawal', 'Disponible para Retiro')}</span>
            <Wallet className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatPrice(withdrawableBalance)}</p>
          {withdrawableBalance > 0 && (
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="mt-2 w-full px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              {lbl('Solicitar Saque', 'Request Withdrawal', 'Solicitar Retiro')}
            </button>
          )}
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10 rounded-lg border border-amber-200 dark:border-amber-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">{lbl('Em Espera (3 dias)', 'On Hold (3 days)', 'En Espera (3 días)')}</span>
            <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{formatPrice(holdBalance)}</p>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">{lbl('Libera após 3 dias da venda', 'Releases 3 days after sale', 'Libera después de 3 días de la venta')}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/10 dark:to-red-900/10 rounded-lg border border-orange-200 dark:border-orange-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">{lbl('Congelado (Disputa)', 'Frozen (Dispute)', 'Congelado (Disputa)')}</span>
            <Snowflake className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{formatPrice(frozenBalance)}</p>
          <p className="text-xs text-orange-600 dark:text-orange-500 mt-2">{lbl('Disputa em aberto', 'Open dispute', 'Disputa abierta')}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-900/10 dark:to-sky-900/10 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">{lbl('Total Sacado', 'Total Withdrawn', 'Total Retirado')}</span>
            <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{formatPrice(totalWithdrawn)}</p>
        </div>
      </div>

      {/* Recent Withdrawals */}
      {withdrawals.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">{lbl('Saques Recentes', 'Recent Withdrawals', 'Retiros Recientes')}</h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {withdrawals.slice(0, 5).map(w => (
              <div key={w.id} className="flex items-center justify-between p-3 px-4">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatPrice(Number(w.amount))}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(w.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  w.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                  w.status === 'approved' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                  w.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400' :
                  w.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {w.status === 'paid' ? lbl('Pago', 'Paid', 'Pagado') :
                   w.status === 'approved' ? lbl('Aprovado', 'Approved', 'Aprobado') :
                   w.status === 'pending' ? lbl('Pendente', 'Pending', 'Pendiente') :
                   w.status === 'rejected' ? lbl('Rejeitado', 'Rejected', 'Rechazado') :
                   w.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{lbl('Solicitar Saque', 'Request Withdrawal', 'Solicitar Retiro')}</h3>
              <button onClick={() => setShowWithdrawModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <p className="text-sm text-green-700 dark:text-green-400">
                  {lbl('Disponível: ', 'Available: ', 'Disponible: ')}<strong>{formatPrice(withdrawableBalance)}</strong>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {lbl('Valor do Saque', 'Withdrawal Amount', 'Monto del Retiro')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="10"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {lbl('Valor mínimo: 10 USDT', 'Minimum amount: 10 USDT', 'Monto mínimo: 10 USDT')}
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  {lbl('Após solicitar, o administrador irá aprovar e processar o pagamento.', 'After requesting, the admin will approve and process the payment.', 'Después de solicitar, el administrador aprobará y procesará el pago.')}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {lbl('Cancelar', 'Cancel', 'Cancelar')}
                </button>
                <button
                  onClick={handleRequestWithdrawal}
                  disabled={withdrawLoading}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md disabled:opacity-50 transition-colors"
                >
                  {withdrawLoading ? lbl('Processando...', 'Processing...', 'Procesando...') : lbl('Confirmar Saque', 'Confirm Withdrawal', 'Confirmar Retiro')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {stats.lowStockProducts > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {stats.lowStockProducts} {lbl('produto(s) com estoque baixo (≤2 unidades).', 'product(s) with low stock (≤2 units).', 'producto(s) con stock bajo (≤2 unidades).')}
          </p>
          <button
            onClick={() => onNavigate?.('products')}
            className="ml-auto text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline"
          >
            {lbl('Ver produtos', 'View products', 'Ver productos')}
          </button>
        </div>
      )}

      {/* Revenue Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {lbl('Receita dos Últimos 7 Dias', 'Last 7 Days Revenue', 'Ingresos de los Últimos 7 Días')}
          </h3>
          <TrendingUp className="h-5 w-5 text-gray-400" />
        </div>
        <div className="flex items-end justify-between gap-2" style={{ height: '160px' }}>
          {revenueData.map((day, i) => {
            const barH = Math.max((day.revenue / maxRevenue) * 128, 6);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <div
                  className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-md transition-all hover:from-blue-600 hover:to-blue-500 group relative"
                  style={{ height: `${barH}px` }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                    {formatPrice(day.revenue)}
                  </div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{day.day}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Recent Orders */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {lbl('Pedidos Recentes', 'Recent Orders', 'Pedidos Recientes')}
            </h3>
            <button
              onClick={() => onNavigate?.('orders')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              {lbl('Ver todos', 'View all', 'Ver todos')}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentSales.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {lbl('Nenhum pedido ainda', 'No orders yet', 'Sin pedidos aún')}
              </div>
            ) : recentSales.map((sale) => (
              <div key={sale.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{sale.product_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{sale.customer_name} · {formatDate(sale.created_at)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatPrice(sale.total_usdt)}</p>
                    {getStatusBadge(sale.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {lbl('Produtos Mais Vendidos', 'Top Products', 'Productos Más Vendidos')}
            </h3>
            <button
              onClick={() => onNavigate?.('products')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              {lbl('Gerenciar', 'Manage', 'Gestionar')}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {topProducts.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {lbl('Nenhum produto ainda', 'No products yet', 'Sin productos aún')}
              </div>
            ) : topProducts.map((product, idx) => (
              <div key={product.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-400">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{product.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {product.total_sales} {lbl('vendidos', 'sold', 'vendidos')} · {lbl('Estoque:', 'Stock:', 'Stock:')} {product.stock}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400 flex-shrink-0">
                    {formatPrice(product.revenue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat icon={Clock} label={lbl('Pendentes', 'Pending', 'Pendientes')} value={stats.pendingOrders} color="text-yellow-600 dark:text-yellow-400" />
        <MiniStat icon={CheckCircle} label={lbl('Concluídos', 'Completed', 'Completados')} value={stats.completedOrders} color="text-green-600 dark:text-green-400" />
        <MiniStat icon={XCircle} label={lbl('Cancelados', 'Cancelled', 'Cancelados')} value={stats.cancelledOrders} color="text-red-600 dark:text-red-400" />
        <MiniStat icon={Package} label={lbl('Estoque Total', 'Total Stock', 'Stock Total')} value={stats.totalStock} color="text-blue-600 dark:text-blue-400" />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, subValue, trend }: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'emerald' | 'blue' | 'indigo' | 'amber';
  subValue?: string;
  trend?: string;
}) {
  const colorMap = {
    emerald: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600',
    indigo: 'from-indigo-500 to-indigo-600',
    amber: 'from-amber-500 to-amber-600',
  };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 lg:p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{label}</p>
          <p className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</p>
          {subValue && <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{subValue}</p>}
        </div>
        <div className={`bg-gradient-to-br ${colorMap[color]} p-2 rounded-lg flex-shrink-0`}>
          <Icon className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex items-center gap-2">
      <Icon className={`h-4 w-4 ${color} flex-shrink-0`} />
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{label}</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
