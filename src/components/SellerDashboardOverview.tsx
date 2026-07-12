import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, ShoppingCart, Package, TrendingUp, TrendingDown,
  Clock, CheckCircle, XCircle, ArrowUpRight, ArrowDownRight,
  Star, Users, AlertTriangle, Eye
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
        <div className="flex items-end justify-between gap-2 h-40">
          {revenueData.map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-md transition-all hover:from-blue-600 hover:to-blue-500 group relative"
                  style={{ height: `${Math.max((day.revenue / maxRevenue) * 100, 4)}%` }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                    {formatPrice(day.revenue)}
                  </div>
                </div>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{day.day}</span>
            </div>
          ))}
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
