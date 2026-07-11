import React, { useState, useEffect } from 'react';
import { ShoppingBag, Search, Calendar, DollarSign, Package, User, Eye, Download, Filter, TrendingUp, CheckCircle, Clock, X, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, Zap, Check, Mail, Lock, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { AdminSaleCancellationModal } from './AdminSaleCancellationModal';

interface Sale {
  id: string;
  user_id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  purchase_price: number;
  credentials: any;
  purchase_date: string;
  created_at: string;
  profiles?: {
    email: string;
    full_name?: string;
  };
  store_orders?: {
    status: string;
    total_usdt: number;
    customer_email: string;
    customer_name?: string;
    cancelled_at?: string;
    cancellation_reason?: string;
    recharge_data?: { email: string; password: string; extra_data?: string } | null;
    delivery_confirmed?: boolean;
  };
}

interface SalesStats {
  total_sales: number;
  total_revenue: number;
  today_sales: number;
  today_revenue: number;
  this_month_sales: number;
  this_month_revenue: number;
  average_order_value: number;
  cancelled_sales: number;
  cancelled_revenue: number;
}

export function AdminSalesManager() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<SalesStats>({
    total_sales: 0,
    total_revenue: 0,
    today_sales: 0,
    today_revenue: 0,
    this_month_sales: 0,
    this_month_revenue: 0,
    average_order_value: 0,
    cancelled_sales: 0,
    cancelled_revenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [customDateRange, setCustomDateRange] = useState({
    start: '',
    end: ''
  });
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [confirmingDelivery, setConfirmingDelivery] = useState<string | null>(null);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [showCancelledSales, setShowCancelledSales] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [salesPerPage] = useState(10);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadSales();
      loadStats();
    }
  }, [isAdmin, dateFilter, customDateRange, showCancelledSales]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, customDateRange, showCancelledSales]);

  async function checkAdminStatus() {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      setIsAdmin(profile?.role === 'admin');
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadSales() {
    try {
      let query = supabase
        .from('user_purchases')
        .select('*, store_orders(*)')
        .order('purchase_date', { ascending: false });

      // Apply date filter
      if (dateFilter !== 'all') {
        const { startDate, endDate } = getDateRange();
        query = query.gte('purchase_date', startDate.toISOString())
                    .lte('purchase_date', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Get unique user IDs from the sales data
      const userIds = [...new Set((data || []).map(sale => sale.user_id))].filter(Boolean);
      
      // Fetch profiles for these users if we have user IDs
      let profilesData: any[] = [];
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);
        
        if (profilesError) {
          console.error('Error loading profiles:', profilesError);
        } else {
          profilesData = profiles || [];
        }
      }
      
      // Map profiles back to sales data
      const salesWithProfiles = (data || []).map(sale => ({
        ...sale,
        profiles: profilesData.find(profile => profile.id === sale.user_id) || {
          email: 'Email não encontrado',
          full_name: null
        }
      }));
      
      setSales(salesWithProfiles);
    } catch (error) {
      console.error('Error loading sales:', error);
    }
  }

  async function loadStats() {
    try {
      let query = supabase
        .from('user_purchases')
        .select('purchase_price, purchase_date, store_orders!inner(status)');

      // Apply date filter to stats as well
      if (dateFilter !== 'all') {
        const { startDate, endDate } = getDateRange();
        query = query.gte('purchase_date', startDate.toISOString())
                    .lte('purchase_date', endDate.toISOString());
      }

      const { data: allSales, error } = await query;

      if (error) throw error;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Separate cancelled and non-cancelled sales
      const activeSales = allSales?.filter(sale => 
        sale.store_orders?.status !== 'cancelled'
      ) || [];

      const cancelledSales = allSales?.filter(sale => 
        sale.store_orders?.status === 'cancelled'
      ) || [];

      // Calculate stats only for non-cancelled sales
      const todaySales = activeSales.filter(sale => 
        new Date(sale.purchase_date) >= today
      );

      const thisMonthSales = activeSales.filter(sale => 
        new Date(sale.purchase_date) >= thisMonth
      );

      const totalRevenue = activeSales.reduce((sum, sale) => sum + sale.purchase_price, 0);
      const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.purchase_price, 0);
      const thisMonthRevenue = thisMonthSales.reduce((sum, sale) => sum + sale.purchase_price, 0);
      const cancelledRevenue = cancelledSales.reduce((sum, sale) => sum + sale.purchase_price, 0);

      setStats({
        total_sales: activeSales.length,
        total_revenue: totalRevenue,
        today_sales: todaySales.length,
        today_revenue: todayRevenue,
        this_month_sales: thisMonthSales.length,
        this_month_revenue: thisMonthRevenue,
        average_order_value: activeSales.length ? totalRevenue / activeSales.length : 0,
        cancelled_sales: cancelledSales.length,
        cancelled_revenue: cancelledRevenue
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  function getDateRange() {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    switch (dateFilter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'custom':
        startDate = customDateRange.start ? new Date(customDateRange.start) : new Date(0);
        endDate = customDateRange.end ? new Date(customDateRange.end + 'T23:59:59') : new Date();
        break;
      default:
        startDate = new Date(0);
    }

    return { startDate, endDate };
  }

  async function handleConfirmDelivery(orderId: string) {
    setConfirmingDelivery(orderId);
    try {
      const { error } = await supabase
        .from('store_orders')
        .update({
          delivery_confirmed: true,
          status: 'delivered',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      if (error) throw error;
      await loadSales();
    } catch (err: any) {
      alert(err.message || 'Erro ao confirmar entrega');
    } finally {
      setConfirmingDelivery(null);
    }
  }

  async function exportSales() {
    try {
      const csvContent = generateCSV(filteredSales);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Generate filename with date range
      let filename = 'vendas';
      if (dateFilter === 'custom' && customDateRange.start && customDateRange.end) {
        filename += `_${customDateRange.start}_${customDateRange.end}`;
      } else if (dateFilter !== 'all') {
        filename += `_${dateFilter}`;
      }
      filename += `_${new Date().toISOString().split('T')[0]}.csv`;
      
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting sales:', error);
      alert('Erro ao exportar vendas');
    }
  }

  function generateCSV(salesData: Sale[]): string {
    const headers = [
      'Data da Compra',
      'Email do Cliente',
      'Nome do Cliente',
      'Produto',
      'Valor Pago',
      'Status do Pedido',
      'Email da Conta',
      'Senha da Conta',
      'Data de Cancelamento',
      'Motivo do Cancelamento'
    ];

    const rows = salesData.map(sale => [
      new Date(sale.purchase_date).toLocaleDateString('pt-BR'),
      sale.profiles?.email || sale.store_orders?.customer_email || '',
      sale.profiles?.full_name || sale.store_orders?.customer_name || '',
      sale.product_name,
      `$${sale.purchase_price.toFixed(2)}`,
      sale.store_orders?.status || 'delivered',
      sale.credentials?.email || '',
      sale.credentials?.password || '',
      sale.store_orders?.cancelled_at ? new Date(sale.store_orders.cancelled_at).toLocaleDateString('pt-BR') : '',
      sale.store_orders?.cancellation_reason || ''
    ]);

    return [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
  }

  const filteredSales = sales.filter(sale => {
    const matchesSearch = 
      sale.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.store_orders?.customer_email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCancellationFilter = showCancelledSales || sale.store_orders?.status !== 'cancelled';
    
    return matchesSearch && matchesCancellationFilter;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredSales.length / salesPerPage);
  const startIndex = (currentPage - 1) * salesPerPage;
  const endIndex = startIndex + salesPerPage;
  const currentSales = filteredSales.slice(startIndex, endIndex);

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <ShoppingBag className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Acesso Restrito</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Apenas administradores podem visualizar as vendas.
        </p>
      </div>
    );
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Gerenciar Vendas</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Visualize e gerencie todas as vendas realizadas na loja
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowCancelledSales(!showCancelledSales)}
            className={`inline-flex items-center justify-center px-3 sm:px-4 py-2 font-medium rounded-lg transition-colors shadow-sm text-sm ${
              showCancelledSales
                ? 'bg-red-600 hover:bg-red-700 text-white border border-red-700'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 dark:border-gray-600'
            }`}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{showCancelledSales ? 'Ocultar Canceladas' : `Mostrar Canceladas (${stats.cancelled_sales})`}</span>
            <span className="sm:hidden">{showCancelledSales ? 'Ocultar' : `Canceladas (${stats.cancelled_sales})`}</span>
          </button>
          <button
            onClick={exportSales}
            className="inline-flex items-center justify-center px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors shadow-sm text-sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Total</p>
              <ShoppingBag className="h-4 w-4 text-blue-500 flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{stats.total_sales}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Receita</p>
              <DollarSign className="h-4 w-4 text-green-500 flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-bold text-green-600 break-all">${stats.total_revenue.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Hoje</p>
              <Calendar className="h-4 w-4 text-blue-500 flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-bold text-blue-600">{stats.today_sales}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Rec. Hoje</p>
              <TrendingUp className="h-4 w-4 text-blue-500 flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-bold text-blue-600 break-all">${stats.today_revenue.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Este Mês</p>
              <Calendar className="h-4 w-4 text-purple-500 flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-bold text-purple-600">{stats.this_month_sales}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Rec. Mês</p>
              <DollarSign className="h-4 w-4 text-purple-500 flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-bold text-purple-600 break-all">${stats.this_month_revenue.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Ticket</p>
              <TrendingUp className="h-4 w-4 text-orange-500 flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-bold text-orange-600 break-all">${stats.average_order_value.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Canceladas</p>
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
            </div>
            <p className="text-base sm:text-lg font-bold text-red-600">{stats.cancelled_sales}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col gap-4">
          {/* Search and basic filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Buscar por produto, cliente, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="all">Todas as Datas</option>
              <option value="today">Hoje</option>
              <option value="week">Última Semana</option>
              <option value="month">Este Mês</option>
              <option value="year">Este Ano</option>
              <option value="custom">Período Personalizado</option>
            </select>
          </div>

          {/* Custom date range */}
          {dateFilter === 'custom' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  Período Personalizado:
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-blue-700 dark:text-blue-400 mb-1">De:</label>
                    <input
                      type="date"
                      value={customDateRange.start}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>

                  <div className="flex-1">
                    <label className="block text-xs text-blue-700 dark:text-blue-400 mb-1">Até:</label>
                    <input
                      type="date"
                      value={customDateRange.end}
                      onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>

                {(customDateRange.start || customDateRange.end) && (
                  <button
                    onClick={() => setCustomDateRange({ start: '', end: '' })}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
                  >
                    Limpar Datas
                  </button>
                )}
              </div>
            </div>
          )}
          
          {/* Summary info */}
          <div className="space-y-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            <div className="flex flex-wrap gap-3 sm:gap-4">
              <span>
                <strong className="text-gray-900 dark:text-white">{filteredSales.length}</strong> vendas encontradas
              </span>
              {dateFilter !== 'all' && (
                <span className="flex-shrink-0">
                  Período: <strong className="text-gray-900 dark:text-white">
                    {dateFilter === 'custom' && customDateRange.start && customDateRange.end
                      ? `${new Date(customDateRange.start).toLocaleDateString('pt-BR')} - ${new Date(customDateRange.end).toLocaleDateString('pt-BR')}`
                      : dateFilter === 'today' ? 'Hoje'
                      : dateFilter === 'week' ? 'Última Semana'
                      : dateFilter === 'month' ? 'Este Mês'
                      : dateFilter === 'year' ? 'Este Ano'
                      : 'Personalizado'
                    }
                  </strong>
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-3 sm:gap-4">
              <span className="flex-shrink-0">Canceladas: <strong className="text-red-600 dark:text-red-400">{stats.cancelled_sales}</strong></span>
              <span className="flex-shrink-0">Perdido: <strong className="text-red-600 dark:text-red-400">${stats.cancelled_revenue.toFixed(2)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Produto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Data da Compra
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Credenciais
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {currentSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                          <Package className="h-5 w-5 text-white" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {sale.profiles?.full_name || sale.store_orders?.customer_name || sale.profiles?.email?.split('@')[0] || 'Cliente'}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {sale.profiles?.email || sale.store_orders?.customer_email || 'Email não disponível'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Package className="h-4 w-4 text-gray-400 mr-2" />
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {sale.product_name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-green-600 dark:text-green-400">
                      ${sale.purchase_price.toFixed(2)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div>
                      {new Date(sale.purchase_date).toLocaleDateString('pt-BR')}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(sale.purchase_date).toLocaleTimeString('pt-BR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      sale.store_orders?.status === 'cancelled' 
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        : sale.store_orders?.status === 'refunded'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        : sale.store_orders?.status === 'paid'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    }`}>
                      {sale.store_orders?.status === 'cancelled' ? (
                        <>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Cancelado
                        </>
                      ) : sale.store_orders?.status === 'refunded' ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Reembolsado
                        </>
                      ) : sale.store_orders?.status === 'paid' ? (
                        <>
                          <Clock className="h-3 w-3 mr-1" />
                          {sale.store_orders?.delivery_confirmed ? 'Entregue' : 'Pendente'}
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Entregue
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {sale.store_orders?.recharge_data ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <Zap className="h-3 w-3" />
                            <span className="font-medium">Recarga</span>
                          </div>
                          <div className="flex items-center gap-1 font-mono">
                            <Mail className="h-3 w-3" />
                            {sale.store_orders.recharge_data.email}
                          </div>
                          <div className="flex items-center gap-1 font-mono">
                            <Lock className="h-3 w-3" />
                            {sale.store_orders.recharge_data.password.substring(0, 8)}...
                          </div>
                          {sale.store_orders.recharge_data.extra_data && (
                            <div className="flex items-center gap-1 text-gray-400">
                              <FileText className="h-3 w-3" />
                              <span className="truncate max-w-[120px]">{sale.store_orders.recharge_data.extra_data}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="font-mono">
                            {sale.credentials?.email ? (
                              <div>📧 {sale.credentials.email}</div>
                            ) : (
                              <div className="text-red-500">Sem credenciais</div>
                            )}
                          </div>
                          {sale.credentials?.password && (
                            <div className="font-mono mt-1">
                              🔑 {sale.credentials.password.substring(0, 8)}...
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedSale(sale);
                          setShowDetails(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {sale.store_orders?.status === 'paid' && !sale.store_orders?.delivery_confirmed && (
                        <button
                          onClick={() => handleConfirmDelivery(sale.store_orders!.id || sale.id)}
                          disabled={confirmingDelivery === (sale.store_orders!.id || sale.id)}
                          className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 transition-colors disabled:opacity-50"
                          title="Confirmar entrega"
                        >
                          {confirmingDelivery === (sale.store_orders!.id || sale.id) ? (
                            <div className="h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      {sale.store_orders?.status !== 'cancelled' && sale.store_orders?.status !== 'refunded' && (
                        <button
                          onClick={() => {
                            setSaleToCancel(sale);
                            setShowCancellationModal(true);
                          }}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                          title="Cancelar venda"
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {currentSales.map((sale) => (
          <div key={sale.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="flex-shrink-0 h-10 w-10">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <Package className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {sale.product_name}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {sale.profiles?.full_name || sale.store_orders?.customer_name || sale.profiles?.email?.split('@')[0] || 'Cliente'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                    {sale.profiles?.email || sale.store_orders?.customer_email || 'Email não disponível'}
                  </p>
                </div>
              </div>
              <div className="text-right ml-2">
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  ${sale.purchase_price.toFixed(2)}
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  sale.store_orders?.status === 'cancelled' 
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    : sale.store_orders?.status === 'refunded'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                    : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                }`}>
                  {sale.store_orders?.status === 'cancelled' ? 'Cancelado' :
                   sale.store_orders?.status === 'refunded' ? 'Reembolsado' :
                   'Entregue'}
                </span>
                {sale.store_orders?.cancelled_at && (
                  <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {new Date(sale.store_orders.cancelled_at).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center">
                  <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span className="break-all">
                    {new Date(sale.purchase_date).toLocaleDateString('pt-BR')} às {new Date(sale.purchase_date).toLocaleTimeString('pt-BR')}
                  </span>
                </div>
                {sale.store_orders?.recharge_data ? (
                  <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs space-y-1">
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                      <Zap className="h-3 w-3" />
                      Recarga de Conta
                    </div>
                    <div className="font-mono break-all flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {sale.store_orders.recharge_data.email}
                    </div>
                    <div className="font-mono break-all flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      {sale.store_orders.recharge_data.password}
                    </div>
                    {sale.store_orders.recharge_data.extra_data && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <FileText className="h-3 w-3" />
                        <span className="break-all">{sale.store_orders.recharge_data.extra_data}</span>
                      </div>
                    )}
                  </div>
                ) : sale.credentials?.email && (
                  <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-600 rounded text-xs">
                    <div className="font-mono break-all">📧 {sale.credentials.email}</div>
                    {sale.credentials.password && (
                      <div className="font-mono break-all">🔑 {sale.credentials.password}</div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedSale(sale);
                    setShowDetails(true);
                  }}
                  className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Detalhes
                </button>
                {sale.store_orders?.status === 'paid' && !sale.store_orders?.delivery_confirmed && (
                  <button
                    onClick={() => handleConfirmDelivery(sale.store_orders!.id || sale.id)}
                    disabled={confirmingDelivery === (sale.store_orders!.id || sale.id)}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  >
                    {confirmingDelivery === (sale.store_orders!.id || sale.id) ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Confirmar Entrega
                      </>
                    )}
                  </button>
                )}
                {sale.store_orders?.status !== 'cancelled' && sale.store_orders?.status !== 'refunded' && (
                  <button
                    onClick={() => {
                      setSaleToCancel(sale);
                      setShowCancellationModal(true);
                    }}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-center sm:text-left">
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Página {currentPage} de {totalPages}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-500">
              ({startIndex + 1}-{Math.min(endIndex, filteredSales.length)} de {filteredSales.length})
            </span>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 sm:p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Page numbers */}
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 sm:p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {filteredSales.length === 0 && (
        <div className="text-center py-12">
          <ShoppingBag className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            {searchTerm || dateFilter !== 'all' || !showCancelledSales ? 'Nenhuma venda encontrada' : 'Nenhuma venda realizada'}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm || dateFilter !== 'all' || !showCancelledSales
              ? 'Tente ajustar os filtros de busca'
              : 'As vendas aparecerão aqui quando os usuários comprarem produtos'
            }
          </p>
        </div>
      )}

      {/* Sale Details Modal */}
      {showDetails && selectedSale && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 p-4">
          <div className="relative top-4 sm:top-10 mx-auto p-4 sm:p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Detalhes da Venda
              </h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Customer Info */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Informações do Cliente
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Nome Completo
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {selectedSale.profiles?.full_name || selectedSale.store_orders?.customer_name || selectedSale.profiles?.email?.split('@')[0] || 'Não informado'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email
                    </label>
                    <p className="mt-1 text-sm text-gray-900 dark:text-white">
                      {selectedSale.profiles?.email || selectedSale.store_orders?.customer_email || 'Email não disponível'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      ID do Usuário
                    </label>
                    <p className="mt-1 text-xs font-mono text-gray-600 dark:text-gray-400 break-all">
                      {selectedSale.user_id}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      ID do Pedido
                    </label>
                    <p className="mt-1 text-xs font-mono text-gray-600 dark:text-gray-400 break-all">
                      {selectedSale.order_id}
                    </p>
                  </div>
                </div>
              </div>

              {/* Product Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-3">
                  Informações do Produto
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-700 dark:text-blue-400">
                      Nome do Produto
                    </label>
                    <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">
                      {selectedSale.product_name}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 dark:text-blue-400">
                      Valor Pago
                    </label>
                    <p className="mt-1 text-sm font-bold text-blue-900 dark:text-blue-200">
                      ${selectedSale.purchase_price.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 dark:text-blue-400">
                      Data da Compra
                    </label>
                    <p className="mt-1 text-sm text-blue-900 dark:text-blue-200">
                      {new Date(selectedSale.purchase_date).toLocaleDateString('pt-BR')} às {new Date(selectedSale.purchase_date).toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 dark:text-blue-400">
                      Status do Pedido
                    </label>
                    <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedSale.store_orders?.status === 'cancelled' 
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                        : selectedSale.store_orders?.status === 'refunded'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    }`}>
                      {selectedSale.store_orders?.status === 'cancelled' ? (
                        <>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Cancelado
                        </>
                      ) : selectedSale.store_orders?.status === 'refunded' ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Reembolsado
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {selectedSale.store_orders?.status || 'delivered'}
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Account Recharge Data */}
              {selectedSale.store_orders?.recharge_data && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <h4 className="text-lg font-medium text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Dados da Conta para Recarga
                  </h4>
                  <div className="bg-white dark:bg-gray-800 rounded-md p-4 border space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                        <Mail className="h-3 w-3" /> Email da Conta:
                      </label>
                      <p className="font-mono text-sm text-gray-900 dark:text-white break-all">
                        {selectedSale.store_orders.recharge_data.email}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Senha da Conta:
                      </label>
                      <p className="font-mono text-sm text-gray-900 dark:text-white break-all">
                        {selectedSale.store_orders.recharge_data.password}
                      </p>
                    </div>
                    {selectedSale.store_orders.recharge_data.extra_data && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                          <FileText className="h-3 w-3" /> Dados Extras:
                        </label>
                        <p className="text-sm text-gray-700 dark:text-gray-300 break-all whitespace-pre-wrap">
                          {selectedSale.store_orders.recharge_data.extra_data}
                        </p>
                      </div>
                    )}
                    {selectedSale.store_orders?.status === 'paid' && !selectedSale.store_orders?.delivery_confirmed && (
                      <button
                        onClick={() => handleConfirmDelivery(selectedSale.store_orders!.id || selectedSale.id)}
                        disabled={confirmingDelivery === (selectedSale.store_orders!.id || selectedSale.id)}
                        className="w-full mt-2 inline-flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
                      >
                        {confirmingDelivery === (selectedSale.store_orders!.id || selectedSale.id) ? (
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1.5" />
                            Confirmar Entrega da Recarga
                          </>
                        )}
                      </button>
                    )}
                    {selectedSale.store_orders?.delivery_confirmed && (
                      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-sm font-medium">
                        <CheckCircle className="h-4 w-4" />
                        Recarga entregue e confirmada
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Delivered Credentials */}
              <div className={`border rounded-lg p-4 ${
                selectedSale.store_orders?.status === 'cancelled'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              }`}>
                <h4 className={`text-lg font-medium mb-3 ${
                  selectedSale.store_orders?.status === 'cancelled'
                    ? 'text-red-800 dark:text-red-300'
                    : 'text-green-800 dark:text-green-300'
                }`}>
                  {selectedSale.store_orders?.status === 'cancelled' 
                    ? 'Credenciais da Venda Cancelada'
                    : 'Credenciais Entregues ao Cliente'
                  }
                </h4>
                
                {selectedSale.store_orders?.status === 'cancelled' && (
                  <div className="mb-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-3">
                    <div className="flex items-center">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
                      <div>
                        <h5 className="text-sm font-medium text-red-800 dark:text-red-300">
                          Venda Cancelada
                        </h5>
                        <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                          Esta venda foi cancelada pelo administrador. O cliente foi reembolsado automaticamente.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="bg-white dark:bg-gray-800 rounded-md p-4 border">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Email da Conta:
                      </label>
                      <p className="font-mono text-sm text-gray-900 dark:text-white break-all">
                        {selectedSale.credentials?.email || 'Credenciais não disponíveis'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Senha da Conta:
                      </label>
                      <p className="font-mono text-sm text-gray-900 dark:text-white">
                        {selectedSale.credentials?.password || 'Credenciais não disponíveis'}
                      
                      </p>
                    </div>
                  </div>
                  
                  {selectedSale.credentials?.instructions && (
                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Instruções Entregues:
                      </label>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {selectedSale.credentials.instructions}
                      </p>
                    </div>
                  )}
                  
                  {selectedSale.store_orders?.status === 'cancelled' && (
                    <div className="mt-2 text-red-600 dark:text-red-400 text-xs">
                      ⚠️ Venda cancelada - Credenciais não válidas
                    </div>
                  )}
                  
                  <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <h5 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                        ℹ️ Informações para o Admin
                      </h5>
                      <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                        <div><strong>Produto ID:</strong> {selectedSale.product_id}</div>
                        <div><strong>Venda ID:</strong> {selectedSale.id}</div>
                        <div><strong>Data de Entrega:</strong> {new Date(selectedSale.created_at).toLocaleString('pt-BR')}</div>
                        {selectedSale.credentials && typeof selectedSale.credentials === 'object' && Object.keys(selectedSale.credentials).length > 0 && (
                          <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                            <strong>Dados JSON Completos:</strong>
                            <pre className="mt-1 text-xs bg-white dark:bg-gray-800 p-2 rounded border overflow-x-auto">
                              {JSON.stringify(selectedSale.credentials || {}, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sale Cancellation Modal */}
      <AdminSaleCancellationModal
        isOpen={showCancellationModal}
        onClose={() => {
          setShowCancellationModal(false);
          setSaleToCancel(null);
        }}
        sale={saleToCancel}
        onSuccess={() => {
          loadSales();
          loadStats();
        }}
      />
    </div>
  );
}