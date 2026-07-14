import React, { useState, useEffect } from 'react';
import { DollarSign, Package, Search, Eye, Calendar, TrendingUp, ShoppingCart, Download, ShieldAlert, X, CreditCard, Clock, CheckCircle, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';

interface SellerSale {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  total_brl: number;
  total_usdt: number;
  status: string;
  customer_name: string;
  created_at: string;
  updated_at: string;
  delivered_at?: string;
  delivered_accounts?: { email: string; password: string; instructions?: string }[];
  test_days_left?: number;
  seller_amount?: number;
  admin_amount?: number;
  admin_rate?: number;
  seller_rate?: number;
}

interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  pendingSales: number;
  completedSales: number;
  cancelledSales: number;
  disputedSales: number;
}

export function SellerSales() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const lang = (t as any).language || 'pt';
  const lbl = (pt: string, en: string, es: string) => lang === 'en' ? en : lang === 'es' ? es : pt;
  const [sales, setSales] = useState<SellerSale[]>([]);
  const [filteredSales, setFilteredSales] = useState<SellerSale[]>([]);
  const [stats, setStats] = useState<SalesStats>({
    totalSales: 0,
    totalRevenue: 0,
    pendingSales: 0,
    completedSales: 0,
    cancelledSales: 0,
    disputedSales: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [selectedSale, setSelectedSale] = useState<SellerSale | null>(null);
  const [sellerLevelInfo, setSellerLevelInfo] = useState<any>(null);

  useEffect(() => {
    loadSales();

    if (user) {
      const channel = supabase
        .channel(`seller-sales:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'store_orders',
            filter: `seller_id=eq.${user.id}`
          },
          () => {
            console.log('Sales updated, reloading...');
            loadSales();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [sales, searchTerm, statusFilter, dateFilter]);

  useEffect(() => {
    function handleOpenOrderDetail(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (!detail?.orderId) return;
      const sale = sales.find(s => s.id === detail.orderId);
      if (sale) setSelectedSale(sale);
    }
    window.addEventListener('open-order-detail', handleOpenOrderDetail);
    return () => window.removeEventListener('open-order-detail', handleOpenOrderDetail);
  }, [sales]);

  async function loadSales() {
    if (!user) return;

    setLoading(true);
    try {
      const [ordersRes, commissionsRes, levelRes] = await Promise.all([
        supabase
          .from('seller_orders_view')
          .select(`
            id,
            product_id,
            quantity,
            total_brl,
            total_usdt,
            status,
            customer_name,
            delivered_at,
            created_at,
            updated_at,
            store_products (
              name
            ),
            store_deliveries (
              delivery_content,
              delivery_method,
              delivery_status,
              delivered_at
            )
          `)
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('sales_commissions')
          .select('order_id, seller_amount, admin_amount, admin_commission_rate, seller_commission_rate, currency')
          .eq('seller_id', user.id)
          .eq('currency', 'USDT'),
        supabase.rpc('get_seller_level_info', { p_seller_id: user.id }),
      ]);

      if (ordersRes.error) throw ordersRes.error;

      const commissionMap = new Map<string, any>();
      (commissionsRes.data || []).forEach((c: any) => {
        commissionMap.set(c.order_id, c);
      });

      if (levelRes.data) setSellerLevelInfo(levelRes.data);

      const ordersData = ordersRes.data || [];

      const salesData: SellerSale[] = (ordersData || []).map(order => {
        const accounts: { email: string; password: string; instructions?: string }[] = [];
        (order as any).store_deliveries?.forEach((d: any) => {
          const content = d.delivery_content;
          if (content) {
            if (Array.isArray(content.accounts)) {
              content.accounts.forEach((a: any) => accounts.push({ email: a.email || '', password: a.password || '', instructions: a.instructions }));
            } else if (content.email) {
              accounts.push({ email: content.email, password: content.password || '', instructions: content.instructions });
            }
          }
        });
        const purchaseDate = new Date(order.created_at);
        const testEnd = new Date(purchaseDate.getTime() + 3 * 24 * 60 * 60 * 1000);
        const daysLeft = Math.max(0, Math.ceil((testEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        const commission = commissionMap.get(order.id);
        return {
          id: order.id,
          product_id: order.product_id,
          product_name: (order.store_products as any)?.name || 'Produto desconhecido',
          quantity: order.quantity,
          total_brl: order.total_brl,
          total_usdt: order.total_usdt,
          status: order.status,
          customer_name: order.customer_name,
          delivered_at: order.delivered_at,
          test_days_left: daysLeft,
          delivered_accounts: accounts,
          created_at: order.created_at,
          updated_at: order.updated_at,
          seller_amount: commission?.seller_amount,
          admin_amount: commission?.admin_amount,
          admin_rate: commission?.admin_commission_rate,
          seller_rate: commission?.seller_commission_rate,
        };
      });

      setSales(salesData);
      calculateStats(salesData);
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setLoading(false);
    }
  }

  function calculateStats(salesData: SellerSale[]) {
    const stats: SalesStats = {
      totalSales: salesData.length,
      totalRevenue: salesData
        .filter(s => s.status === 'completed')
        .reduce((sum, sale) => sum + sale.total_usdt, 0),
      pendingSales: salesData.filter(s => ['pending', 'processing', 'paid', 'delivered', 'disputed'].includes(s.status)).length,
      completedSales: salesData.filter(s => s.status === 'completed').length,
      cancelledSales: salesData.filter(s => s.status === 'cancelled' || s.status === 'refunded').length,
      disputedSales: salesData.filter(s => s.status === 'disputed').length
    };

    setStats(stats);
  }

  function applyFilters() {
    let filtered = [...sales];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        sale =>
          sale.product_name.toLowerCase().includes(term) ||
          sale.customer_name.toLowerCase().includes(term) ||
          sale.id.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(sale => sale.status === statusFilter);
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();

      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(sale => new Date(sale.created_at) >= filterDate);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter(sale => new Date(sale.created_at) >= filterDate);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter(sale => new Date(sale.created_at) >= filterDate);
          break;
      }
    }

    setFilteredSales(filtered);
  }

  function getStatusBadge(status: string) {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400', label: 'Pendente' },
      processing: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400', label: 'Processando' },
      paid: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400', label: 'Pago' },
      delivered: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400', label: 'Entregue' },
      completed: { color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400', label: 'Concluído' },
      cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400', label: 'Cancelado' },
      refunded: { color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400', label: 'Reembolsado' },
      disputed: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400', label: 'Disputa Aberta' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function exportToCSV() {
    const headers = ['ID', 'Data', 'Produto', 'Cliente', 'Quantidade', 'Valor (USD)', 'Status'];
    const rows = filteredSales.map(sale => [
      sale.id,
      formatDate(sale.created_at),
      sale.product_name,
      sale.customer_name,
      sale.quantity.toString(),
      sale.total_usdt.toFixed(2),
      sale.status
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `vendas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Minhas Vendas</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Acompanhe todas as suas vendas e estatísticas
          </p>
        </div>
        <button
          onClick={exportToCSV}
          disabled={filteredSales.length === 0}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </button>
      </div>

      {/* Level Benefits Banner */}
      {sellerLevelInfo && (
        <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ backgroundColor: (sellerLevelInfo.current_tier_color || '#3b82f6') + '20', color: sellerLevelInfo.current_tier_color || '#3b82f6' }}>
                <Award className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{sellerLevelInfo.current_tier_name} · {lbl('Nível', 'Level', 'Nivel')} {sellerLevelInfo.seller_level}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {lbl('Taxa atual', 'Current fee', 'Comisión actual')}: <span className="font-semibold text-red-500">{sellerLevelInfo.admin_rate}%</span> · {lbl('Você recebe', 'You keep', 'Recibes')}: <span className="font-semibold text-green-500">{sellerLevelInfo.seller_rate}%</span>
                </p>
              </div>
            </div>
            {sellerLevelInfo.next_tier_name && (
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">{lbl('Próximo nível', 'Next tier', 'Siguiente nivel')}: {sellerLevelInfo.next_tier_name} ({lbl('Nível', 'Level', 'Nivel')} {sellerLevelInfo.next_tier_min_level})</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full" style={{ width: `${sellerLevelInfo.progress_pct}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{sellerLevelInfo.progress_pct}%</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{sellerLevelInfo.xp_to_next_tier} XP {lbl('restantes', 'remaining', 'restantes')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total de Vendas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalSales}</p>
            </div>
            <ShoppingCart className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Receita Total</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                {formatPrice(stats.totalRevenue)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{stats.pendingSales}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Concluídas</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.completedSales}</p>
            </div>
            <Package className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Canceladas</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.cancelledSales}</p>
            </div>
            <Eye className="h-8 w-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Disputas</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">{stats.disputedSales}</p>
            </div>
            <ShieldAlert className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por produto, cliente, email ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="processing">Processando</option>
            <option value="paid">Pago</option>
            <option value="delivered">Entregue</option>
            <option value="completed">Concluído</option>
            <option value="cancelled">Cancelado</option>
            <option value="refunded">Reembolsado</option>
            <option value="disputed">Disputa Aberta</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Todo o período</option>
            <option value="today">Hoje</option>
            <option value="week">Última semana</option>
            <option value="month">Último mês</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Produto
                </th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Qtd
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {lbl('Valor', 'Amount', 'Valor')}
                </th>
                <th className="hidden lg:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {lbl('Lucro', 'Profit', 'Ganancia')}
                </th>
                <th className="hidden lg:table-cell px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {lbl('Taxa Plataforma', 'Platform Fee', 'Comisión')}
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {lbl('Ações', 'Actions', 'Acciones')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="hidden sm:inline">{formatDate(sale.created_at)}</span>
                      <span className="sm:hidden">{new Date(sale.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    <div className="flex items-center">
                      <Package className="h-4 w-4 mr-2 text-gray-400" />
                      {sale.product_name}
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {sale.customer_name}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {sale.quantity}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                    {formatPrice(sale.total_usdt)}
                  </td>
                  <td className="hidden lg:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                    {sale.seller_amount != null ? formatPrice(sale.seller_amount) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="hidden lg:table-cell px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-red-500 dark:text-red-400">
                    {sale.admin_amount != null ? (
                      <span>{formatPrice(sale.admin_amount)} <span className="text-xs text-gray-400">({sale.admin_rate}%)</span></span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(sale.status)}
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => setSelectedSale(sale)}
                      className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      {lbl('Detalhes', 'Details', 'Detalles')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredSales.length === 0 && (
        <div className="text-center py-12">
          <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Nenhuma venda encontrada</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {sales.length === 0
              ? 'Você ainda não realizou nenhuma venda'
              : 'Nenhuma venda corresponde aos filtros selecionados'}
          </p>
        </div>
      )}
    </div>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {lbl('Detalhes da Venda', 'Sale Details', 'Detalles de Venta')}
              </h3>
              <button onClick={() => setSelectedSale(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Product Info */}
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{lbl('Produto', 'Product', 'Producto')}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedSale.product_name}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{lbl('Cliente', 'Customer', 'Cliente')}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedSale.customer_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{lbl('Data', 'Date', 'Fecha')}</span>
                <span className="text-sm text-gray-900 dark:text-white">{formatDate(selectedSale.created_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{lbl('Valor Total', 'Total Amount', 'Valor Total')}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatPrice(selectedSale.total_usdt)}</span>
              </div>
              {selectedSale.seller_amount != null && selectedSale.admin_amount != null && (
                <>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">{lbl('Seu Lucro', 'Your Profit', 'Tu Ganancia')} ({selectedSale.seller_rate}%)</span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">{formatPrice(selectedSale.seller_amount)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <span className="text-sm font-medium text-red-700 dark:text-red-400">{lbl('Taxa da Plataforma', 'Platform Fee', 'Comisión Plataforma')} ({selectedSale.admin_rate}%)</span>
                    <span className="text-sm font-bold text-red-500 dark:text-red-400">{formatPrice(selectedSale.admin_amount)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{lbl('Status', 'Status', 'Estado')}</span>
                {getStatusBadge(selectedSale.status)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{lbl('Quantidade', 'Quantity', 'Cantidad')}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{selectedSale.quantity}</span>
              </div>

              {/* Test Period Indicator */}
              {!['cancelled', 'refunded', 'completed'].includes(selectedSale.status) && (
                <div className="flex items-center justify-between py-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Clock className="h-4 w-4 text-gray-400" />
                    {lbl('Período de Teste', 'Test Period', 'Período de Prueba')}
                  </span>
                  <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                    (selectedSale.test_days_left || 0) > 0
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {(selectedSale.test_days_left || 0) > 0
                      ? lbl(`${selectedSale.test_days_left}d restante${(selectedSale.test_days_left || 0) > 1 ? 's' : ''}`, `${selectedSale.test_days_left}d left`, `${selectedSale.test_days_left}d restante${(selectedSale.test_days_left || 0) > 1 ? 's' : ''}`)
                      : lbl('Encerrado', 'Ended', 'Terminado')}
                  </span>
                </div>
              )}

              {/* Delivery Confirmed Info */}
              {selectedSale.delivered_at && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs text-green-700 dark:text-green-400">
                    {lbl('Recebimento confirmado em', 'Delivery confirmed on', 'Recepción confirmada el')} {formatDate(selectedSale.delivered_at)}
                  </span>
                </div>
              )}

              {/* Delivered Accounts */}
              {selectedSale.delivered_accounts && selectedSale.delivered_accounts.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <CreditCard className="h-4 w-4 text-gray-400" />
                    {lbl('Contas Entregues', 'Delivered Accounts', 'Cuentas Entregadas')}
                    <span className="text-xs text-gray-500 dark:text-gray-400">({selectedSale.delivered_accounts.length})</span>
                  </span>
                  <div className="space-y-1.5">
                    {selectedSale.delivered_accounts.map((acct, idx) => (
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
            <div className="p-5 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setSelectedSale(null)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                {lbl('Fechar', 'Close', 'Cerrar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
