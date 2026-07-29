import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShoppingBag, Search, Calendar, DollarSign, Package, Eye, Download,
  TrendingUp, CheckCircle, Clock, X, AlertTriangle, RefreshCw, ChevronLeft,
  ChevronRight, Zap, Check, Mail, Lock, FileText, ShieldAlert, Tag,
  Percent, Wallet, Store, User, Image as ImageIcon, ShieldCheck, Coins,
  ArrowUpDown, Clock3, Hash, Star, Filter, SlidersHorizontal, Receipt,
  ArrowUpRight, ArrowDownRight, Activity, ShoppingCart, XCircle,
} from 'lucide-react';
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
    username?: string;
    avatar_url?: string;
  };
  store_orders?: {
    id: string;
    status: string;
    total_usdt: number;
    customer_email: string;
    customer_name?: string;
    cancelled_at?: string;
    cancellation_reason?: string;
    recharge_data?: { email: string; password: string; extra_data?: string } | null;
    delivery_confirmed?: boolean;
    discount_amount?: number;
    cashback_used?: number;
    coupon_id?: string | null;
    seller_id?: string | null;
    variation_name?: string | null;
    delivered_at?: string | null;
    quantity?: number;
  };
  store_products?: {
    image_url: string | null;
    category: string;
    warranty_days: number | null;
    delivery_time: string | null;
    manual_delivery: boolean;
    auto_delivery: boolean;
    account_recharge: boolean;
    is_featured: boolean;
  } | null;
  seller_profile?: {
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    seller_slug: string | null;
  } | null;
  coupon?: {
    code: string;
    name: string;
    discount_type: string;
    discount_value: number;
  } | null;
  commission?: {
    admin_amount: number;
    seller_amount: number;
    admin_commission_rate: number;
    seller_commission_rate: number;
    status: string;
  } | null;
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
  total_fees: number;
  total_seller_profit: number;
  total_discounts: number;
  total_cashback: number;
}

type SortField = 'date' | 'price' | 'product' | 'customer';
type SortDir = 'asc' | 'desc';

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; icon: React.ReactNode; label: string }> = {
  cancelled: { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500', icon: <XCircle className="h-3 w-3" />, label: 'Cancelado' },
  refunded: { bg: 'bg-yellow-50 dark:bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-500', icon: <RefreshCw className="h-3 w-3" />, label: 'Reembolsado' },
  disputed: { bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500', icon: <ShieldAlert className="h-3 w-3" />, label: 'Disputa' },
  paid: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', icon: <Clock className="h-3 w-3" />, label: 'Pendente' },
  delivered: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', icon: <CheckCircle className="h-3 w-3" />, label: 'Entregue' },
  completed: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500', icon: <CheckCircle className="h-3 w-3" />, label: 'Concluído' },
};

function StatusBadge({ status }: { status?: string }) {
  const c = STATUS_CONFIG[status || 'delivered'] || STATUS_CONFIG.delivered;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

function Avatar({ src, name, gradient, size = 'md' }: { src?: string; name: string; gradient: string; size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'w-7 h-7 text-[10px]', md: 'w-9 h-9 text-xs', lg: 'w-12 h-12 text-sm' };
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`${dims[size]} rounded-full object-cover border border-gray-200 dark:border-gray-600 flex-shrink-0`}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div className={`${dims[size]} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, color, bg, trend, subtitle,
}: {
  label: string; value: string; icon: React.ElementType; color: string; bg: string; trend?: 'up' | 'down'; subtitle?: string;
}) {
  return (
    <div className="group bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        {trend === 'up' && <ArrowUpRight className="h-4 w-4 text-emerald-500" />}
        {trend === 'down' && <ArrowDownRight className="h-4 w-4 text-red-500" />}
      </div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-3">{label}</p>
      <p className={`text-xl font-bold ${color} mt-0.5 break-all`}>{value}</p>
      {subtitle && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function DeliveryTypeBadge({ product }: { product: Sale['store_products'] }) {
  if (!product) return null;
  if (product.account_recharge) return <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"><Zap className="h-2.5 w-2.5" /> Recarga</span>;
  if (product.manual_delivery) return <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400"><Clock3 className="h-2.5 w-2.5" /> Manual</span>;
  return <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400"><Zap className="h-2.5 w-2.5" /> Auto</span>;
}

export function AdminSalesManager() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [sales, setSales] = useState<Sale[]>([]);
  const [stats, setStats] = useState<SalesStats>({
    total_sales: 0, total_revenue: 0, today_sales: 0, today_revenue: 0,
    this_month_sales: 0, this_month_revenue: 0, average_order_value: 0,
    cancelled_sales: 0, cancelled_revenue: 0,
    total_fees: 0, total_seller_profit: 0, total_discounts: 0, total_cashback: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [confirmingDelivery, setConfirmingDelivery] = useState<string | null>(null);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [showCancelledSales, setShowCancelledSales] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [salesPerPage] = useState(12);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { checkAdminStatus(); }, []);

  useEffect(() => {
    if (isAdmin) { loadSales(); loadStats(); }
  }, [isAdmin, dateFilter, customDateRange, showCancelledSales]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, dateFilter, customDateRange, showCancelledSales, statusFilter]);

  async function checkAdminStatus() {
    if (!user) return;
    try {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      setIsAdmin(profile?.role === 'admin');
    } catch { setIsAdmin(false); } finally { setLoading(false); }
  }

  async function loadSales() {
    try {
      let query = supabase
        .from('user_purchases')
        .select('*, store_orders(*)')
        .order('purchase_date', { ascending: false });

      if (dateFilter !== 'all') {
        const { startDate, endDate } = getDateRange();
        query = query.gte('purchase_date', startDate.toISOString()).lte('purchase_date', endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const userIds = [...new Set((data || []).map(s => s.user_id))].filter(Boolean);
      const sellerIds = [...new Set((data || []).map(s => s.store_orders?.seller_id).filter(Boolean))] as string[];
      const couponIds = [...new Set((data || []).map(s => s.store_orders?.coupon_id).filter(Boolean))] as string[];
      const productIds = [...new Set((data || []).map(s => s.product_id).filter(Boolean))] as string[];
      const orderIds = [...new Set((data || []).map(s => s.order_id).filter(Boolean))] as string[];

      const [profilesRes, productsRes, couponsRes, commissionsRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from('profiles').select('id, email, full_name, username, avatar_url').in('id', userIds)
          : Promise.resolve({ data: [], error: null }),
        productIds.length > 0
          ? supabase.from('store_products').select('id, image_url, category, warranty_days, delivery_time, manual_delivery, auto_delivery, account_recharge, is_featured').in('id', productIds)
          : Promise.resolve({ data: [], error: null }),
        couponIds.length > 0
          ? supabase.from('discount_coupons').select('id, code, name, discount_type, discount_value').in('id', couponIds)
          : Promise.resolve({ data: [], error: null }),
        orderIds.length > 0
          ? supabase.from('sales_commissions').select('order_id, admin_amount, seller_amount, admin_commission_rate, seller_commission_rate, status').in('order_id', orderIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const sellerRes = sellerIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, username, avatar_url, seller_slug').in('id', sellerIds)
        : { data: [], error: null };

      const profilesMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
      const productsMap = new Map((productsRes.data || []).map((p: any) => [p.id, p]));
      const couponsMap = new Map((couponsRes.data || []).map((c: any) => [c.id, c]));
      const commissionsMap = new Map((commissionsRes.data || []).map((c: any) => [c.order_id, c]));
      const sellersMap = new Map((sellerRes.data || []).map((s: any) => [s.id, s]));

      const enriched: Sale[] = (data || []).map(sale => ({
        ...sale,
        profiles: profilesMap.get(sale.user_id) || { email: 'Email não encontrado' },
        store_products: productsMap.get(sale.product_id) || null,
        coupon: sale.store_orders?.coupon_id ? couponsMap.get(sale.store_orders.coupon_id) || null : null,
        commission: sale.order_id ? commissionsMap.get(sale.order_id) || null : null,
        seller_profile: sale.store_orders?.seller_id ? sellersMap.get(sale.store_orders.seller_id) || null : null,
      }));

      setSales(enriched);
    } catch (error) {
      console.error('Error loading sales:', error);
    }
  }

  async function loadStats() {
    try {
      let query = supabase
        .from('user_purchases')
        .select('purchase_price, purchase_date, order_id, store_orders!inner(status)')
        .order('purchase_date', { ascending: false });

      if (dateFilter !== 'all') {
        const { startDate, endDate } = getDateRange();
        query = query.gte('purchase_date', startDate.toISOString()).lte('purchase_date', endDate.toISOString());
      }

      const { data: allSales, error } = await query;
      if (error) throw error;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const activeSales = (allSales || []).filter(s => s.store_orders?.status !== 'cancelled');
      const cancelledSales = (allSales || []).filter(s => s.store_orders?.status === 'cancelled');

      const todaySales = activeSales.filter(s => new Date(s.purchase_date) >= today);
      const thisMonthSales = activeSales.filter(s => new Date(s.purchase_date) >= thisMonth);

      const totalRevenue = activeSales.reduce((sum, s) => sum + s.purchase_price, 0);
      const totalDiscounts = activeSales.reduce((sum, s) => sum + (s.store_orders?.discount_amount || 0), 0);
      const totalCashback = activeSales.reduce((sum, s) => sum + (s.store_orders?.cashback_used || 0), 0);

      const orderIds = activeSales.map(s => s.order_id).filter(Boolean) as string[];
      let totalFees = 0;
      let totalSellerProfit = 0;
      if (orderIds.length > 0) {
        const { data: commissions } = await supabase
          .from('sales_commissions')
          .select('admin_amount, seller_amount')
          .in('order_id', orderIds);
        totalFees = (commissions || []).reduce((sum, c) => sum + Number(c.admin_amount || 0), 0);
        totalSellerProfit = (commissions || []).reduce((sum, c) => sum + Number(c.seller_amount || 0), 0);
      }

      setStats({
        total_sales: activeSales.length,
        total_revenue: totalRevenue,
        today_sales: todaySales.length,
        today_revenue: todaySales.reduce((sum, s) => sum + s.purchase_price, 0),
        this_month_sales: thisMonthSales.length,
        this_month_revenue: thisMonthSales.reduce((sum, s) => sum + s.purchase_price, 0),
        average_order_value: activeSales.length ? totalRevenue / activeSales.length : 0,
        cancelled_sales: cancelledSales.length,
        cancelled_revenue: cancelledSales.reduce((sum, s) => sum + s.purchase_price, 0),
        total_fees: totalFees,
        total_seller_profit: totalSellerProfit,
        total_discounts: totalDiscounts,
        total_cashback: totalCashback,
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
      case 'today': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case 'week': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'year': startDate = new Date(now.getFullYear(), 0, 1); break;
      case 'custom':
        startDate = customDateRange.start ? new Date(customDateRange.start) : new Date(0);
        endDate = customDateRange.end ? new Date(customDateRange.end + 'T23:59:59') : new Date();
        break;
      default: startDate = new Date(0);
    }
    return { startDate, endDate };
  }

  const handleConfirmDelivery = useCallback(async (orderId: string) => {
    setConfirmingDelivery(orderId);
    try {
      const { error } = await supabase
        .from('store_orders')
        .update({ delivery_confirmed: true, status: 'delivered', updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw error;
      await loadSales();
      await loadStats();
    } catch (err: any) {
      alert(err.message || 'Erro ao confirmar entrega');
    } finally {
      setConfirmingDelivery(null);
    }
  }, []);

  function exportSales() {
    const csv = generateCSV(filteredSales);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
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
  }

  function generateCSV(salesData: Sale[]): string {
    const headers = [
      'Data', 'Produto', 'Categoria', 'Variacao', 'Cliente', 'Email Cliente',
      'Vendedor', 'Valor Pago', 'Desconto', 'Cupom', 'Cashback', 'Taxa Plataforma',
      'Lucro Vendedor', 'Status', 'Garantia (dias)', 'Tempo Entrega', 'Quantidade',
    ];
    const rows = salesData.map(s => [
      new Date(s.purchase_date).toLocaleDateString('pt-BR'),
      s.product_name,
      s.store_products?.category || '',
      s.store_orders?.variation_name || '',
      s.profiles?.username || s.profiles?.full_name || s.store_orders?.customer_name || '',
      s.profiles?.email || s.store_orders?.customer_email || '',
      s.seller_profile?.full_name || s.seller_profile?.username || 'Admin',
      `$${s.purchase_price.toFixed(2)}`,
      s.store_orders?.discount_amount ? `$${Number(s.store_orders.discount_amount).toFixed(2)}` : '',
      s.coupon?.code || '',
      s.store_orders?.cashback_used ? `$${Number(s.store_orders.cashback_used).toFixed(2)}` : '',
      s.commission ? `$${Number(s.commission.admin_amount).toFixed(2)}` : '',
      s.commission ? `$${Number(s.commission.seller_amount).toFixed(2)}` : '',
      s.store_orders?.status || 'delivered',
      s.store_products?.warranty_days?.toString() || '',
      s.store_products?.delivery_time || '',
      s.store_orders?.quantity?.toString() || '1',
    ]);
    return [headers, ...rows].map(row => row.map(f => `"${f}"`).join(',')).join('\n');
  }

  const filteredSales = useMemo(() => {
    let result = sales.filter(sale => {
      const matchesSearch =
        sale.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.profiles?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.store_orders?.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.seller_profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.seller_profile?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.coupon?.code?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCancellation = showCancelledSales || sale.store_orders?.status !== 'cancelled';
      const matchesStatus = statusFilter === 'all' || sale.store_orders?.status === statusFilter;
      return matchesSearch && matchesCancellation && matchesStatus;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'price': cmp = a.purchase_price - b.purchase_price; break;
        case 'product': cmp = a.product_name.localeCompare(b.product_name); break;
        case 'customer':
          cmp = (a.profiles?.username || a.profiles?.full_name || '').localeCompare(b.profiles?.username || b.profiles?.full_name || '');
          break;
        default: cmp = new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime();
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [sales, searchTerm, showCancelledSales, statusFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filteredSales.length / salesPerPage);
  const startIndex = (currentPage - 1) * salesPerPage;
  const endIndex = startIndex + salesPerPage;
  const currentSales = filteredSales.slice(startIndex, endIndex);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  const hasActiveFilters = searchTerm || dateFilter !== 'all' || statusFilter !== 'all' || !showCancelledSales;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <ShoppingBag className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Acesso Restrito</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Apenas administradores podem visualizar as vendas.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
          ))}
        </div>
        <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const primaryStats = [
    { label: 'Receita Total', value: `$${stats.total_revenue.toFixed(2)}`, icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10', subtitle: `${stats.total_sales} vendas` },
    { label: 'Vendas Hoje', value: stats.today_sales.toString(), icon: ShoppingCart, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10', subtitle: `$${stats.today_revenue.toFixed(2)}` },
    { label: 'Receita do Mês', value: `$${stats.this_month_revenue.toFixed(2)}`, icon: TrendingUp, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-500/10', subtitle: `${stats.this_month_sales} vendas` },
    { label: 'Ticket Médio', value: `$${stats.average_order_value.toFixed(2)}`, icon: Receipt, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-500/10', subtitle: 'Por venda' },
  ];

  const secondaryStats = [
    { label: 'Taxas Plataforma', value: `$${stats.total_fees.toFixed(2)}`, icon: Percent, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-500/10' },
    { label: 'Lucro Vendedores', value: `$${stats.total_seller_profit.toFixed(2)}`, icon: Wallet, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-500/10' },
    { label: 'Descontos', value: `$${stats.total_discounts.toFixed(2)}`, icon: Tag, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-500/10' },
    { label: 'Cashback Usado', value: `$${stats.total_cashback.toFixed(2)}`, icon: Coins, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10' },
    { label: 'Vendas Canceladas', value: stats.cancelled_sales.toString(), icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-500/10' },
    { label: 'Receita Perdida', value: `$${stats.cancelled_revenue.toFixed(2)}`, icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-500/10' },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShoppingBag className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Gerenciar Vendas</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Acompanhe e gerencie todas as vendas da loja</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowCancelledSales(!showCancelledSales)}
            className={`inline-flex items-center justify-center px-4 py-2.5 font-semibold rounded-xl transition-all text-sm ${
              showCancelledSales
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300'
            }`}
          >
            <XCircle className="h-4 w-4 mr-2" />
            {showCancelledSales ? 'Ocultar Canceladas' : `Canceladas (${stats.cancelled_sales})`}
          </button>
          <button
            onClick={exportSales}
            disabled={filteredSales.length === 0}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {primaryStats.map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {secondaryStats.map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Search bar */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700/50">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar por produto, cliente, vendedor, cupom..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-10 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm transition-all"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`sm:hidden inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                showFilters || dateFilter !== 'all' || statusFilter !== 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filtros
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className={`p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center ${showFilters ? 'block' : 'hidden sm:flex'}`}>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filtrar:</span>
          </div>
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="w-full sm:w-auto px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm transition-all">
            <option value="all">Todas as Datas</option>
            <option value="today">Hoje</option>
            <option value="week">Última Semana</option>
            <option value="month">Este Mês</option>
            <option value="year">Este Ano</option>
            <option value="custom">Período Personalizado</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm transition-all">
            <option value="all">Todos Status</option>
            <option value="delivered">Entregue</option>
            <option value="completed">Concluído</option>
            <option value="paid">Pendente</option>
            <option value="cancelled">Cancelado</option>
            <option value="refunded">Reembolsado</option>
            <option value="disputed">Disputa</option>
          </select>
          {hasActiveFilters && (
            <button
              onClick={() => { setSearchTerm(''); setDateFilter('all'); setStatusFilter('all'); setCustomDateRange({ start: '', end: '' }); setShowCancelledSales(false); }}
              className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Custom date range */}
        {dateFilter === 'custom' && (
          <div className="px-4 pb-4">
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">Período Personalizado</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-blue-700 dark:text-blue-400 mb-1">De:</label>
                  <input type="date" value={customDateRange.start} onChange={e => setCustomDateRange(p => ({ ...p, start: e.target.value }))}
                    className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-blue-700 dark:text-blue-400 mb-1">Até:</label>
                  <input type="date" value={customDateRange.end} onChange={e => setCustomDateRange(p => ({ ...p, end: e.target.value }))}
                    className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600/50 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
                </div>
                {(customDateRange.start || customDateRange.end) && (
                  <button onClick={() => setCustomDateRange({ start: '', end: '' })}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors self-end">
                    Limpar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Result count */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700/50 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            <strong className="text-gray-900 dark:text-white">{filteredSales.length}</strong> vendas encontradas
          </span>
          <span>Canceladas: <strong className="text-red-600 dark:text-red-400">{stats.cancelled_sales}</strong></span>
          <span>Receita perdida: <strong className="text-red-600 dark:text-red-400">${stats.cancelled_revenue.toFixed(2)}</strong></span>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors" onClick={() => toggleSort('product')}>
                  <span className="flex items-center gap-1.5">Produto {sortField === 'product' && <ArrowUpDown className="h-3 w-3" />}</span>
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vendedor</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors" onClick={() => toggleSort('customer')}>
                  <span className="flex items-center gap-1.5">Cliente {sortField === 'customer' && <ArrowUpDown className="h-3 w-3" />}</span>
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors" onClick={() => toggleSort('price')}>
                  <span className="flex items-center gap-1.5">Valor {sortField === 'price' && <ArrowUpDown className="h-3 w-3" />}</span>
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cupom/Cashback</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Taxa/Lucro</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Garantia</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors" onClick={() => toggleSort('date')}>
                  <span className="flex items-center gap-1.5">Data {sortField === 'date' && <ArrowUpDown className="h-3 w-3" />}</span>
                </th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {currentSales.map(sale => {
                const hasCoupon = sale.store_orders?.discount_amount && Number(sale.store_orders.discount_amount) > 0;
                const hasCashback = sale.store_orders?.cashback_used && Number(sale.store_orders.cashback_used) > 0;
                const hasCommission = !!sale.commission;
                return (
                  <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                          {sale.store_products?.image_url ? (
                            <img src={sale.store_products.image_url} alt={sale.product_name} className="w-full h-full object-cover" loading="lazy"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-5 w-5 text-gray-400" /></div>
                          )}
                        </div>
                        <div className="min-w-0 max-w-[220px]">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{sale.product_name}</p>
                            {sale.store_products?.is_featured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{sale.store_products?.category || '—'}</span>
                            {sale.store_orders?.variation_name && (
                              <span className="text-xs px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{sale.store_orders.variation_name}</span>
                            )}
                          </div>
                          <DeliveryTypeBadge product={sale.store_products} />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {sale.seller_profile ? (
                        <div className="flex items-center gap-2.5">
                          <Avatar src={sale.seller_profile.avatar_url || undefined} name={sale.seller_profile.full_name || sale.seller_profile.username || 'V'} gradient="from-indigo-400 to-blue-500" size="sm" />
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[140px]">{sale.seller_profile.full_name || sale.seller_profile.username || 'Vendedor'}</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center"><Store className="h-3.5 w-3.5 text-white" /></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">Loja Admin</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <Avatar src={sale.profiles?.avatar_url || undefined} name={sale.profiles?.username || sale.profiles?.full_name || sale.profiles?.email || 'C'} gradient="from-emerald-400 to-teal-500" size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[140px]">{sale.profiles?.username || sale.profiles?.full_name || sale.store_orders?.customer_name || 'Cliente'}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[160px]">{sale.profiles?.email || sale.store_orders?.customer_email || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">${sale.purchase_price.toFixed(2)}</div>
                      {sale.store_orders?.quantity && sale.store_orders.quantity > 1 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">x{sale.store_orders.quantity}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {hasCoupon || hasCashback ? (
                        <div className="space-y-1">
                          {hasCoupon && (
                            <div className="flex items-center gap-1"><Tag className="h-3 w-3 text-pink-500" /><span className="text-xs font-medium text-pink-600 dark:text-pink-400">{sale.coupon?.code || 'Cupom'} -${Number(sale.store_orders!.discount_amount).toFixed(2)}</span></div>
                          )}
                          {hasCashback && (
                            <div className="flex items-center gap-1"><Coins className="h-3 w-3 text-amber-500" /><span className="text-xs font-medium text-amber-600 dark:text-amber-400">-${Number(sale.store_orders!.cashback_used).toFixed(2)}</span></div>
                          )}
                        </div>
                      ) : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {hasCommission ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1"><Percent className="h-3 w-3 text-teal-500" /><span className="text-xs font-medium text-teal-600 dark:text-teal-400">${Number(sale.commission!.admin_amount).toFixed(2)}</span></div>
                          <div className="flex items-center gap-1"><Wallet className="h-3 w-3 text-indigo-500" /><span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">${Number(sale.commission!.seller_amount).toFixed(2)}</span></div>
                        </div>
                      ) : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {sale.store_products?.warranty_days != null && sale.store_products.warranty_days > 0 ? (
                        <div className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /><span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{sale.store_products.warranty_days}d</span></div>
                      ) : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">{new Date(sale.purchase_date).toLocaleDateString('pt-BR')}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(sale.purchase_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap"><StatusBadge status={sale.store_orders?.status} /></td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setSelectedSale(sale); setShowDetails(true); }}
                          className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10 transition-colors" title="Ver detalhes">
                          <Eye className="h-4 w-4" />
                        </button>
                        {sale.store_orders?.status === 'paid' && !sale.store_orders?.delivery_confirmed && (
                          <button onClick={() => handleConfirmDelivery(sale.store_orders!.id || sale.id)}
                            disabled={confirmingDelivery === (sale.store_orders!.id || sale.id)}
                            className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10 transition-colors disabled:opacity-50" title="Confirmar entrega">
                            {confirmingDelivery === (sale.store_orders!.id || sale.id) ? <div className="h-4 w-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /> : <Check className="h-4 w-4" />}
                          </button>
                        )}
                        {sale.store_orders?.status !== 'cancelled' && sale.store_orders?.status !== 'refunded' && (
                          <button onClick={() => { setSaleToCancel(sale); setShowCancellationModal(true); }}
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 transition-colors" title="Cancelar venda">
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {currentSales.map(sale => {
          const hasCoupon = sale.store_orders?.discount_amount && Number(sale.store_orders.discount_amount) > 0;
          const hasCashback = sale.store_orders?.cashback_used && Number(sale.store_orders.cashback_used) > 0;
          const hasCommission = !!sale.commission;
          return (
            <div key={sale.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                  {sale.store_products?.image_url ? (
                    <img src={sale.store_products.image_url} alt={sale.product_name} className="w-full h-full object-cover" loading="lazy"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-6 w-6 text-gray-400" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{sale.product_name}</p>
                    {sale.store_products?.is_featured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize mt-0.5">
                    {sale.store_products?.category || '—'}
                    {sale.store_orders?.variation_name && ` · ${sale.store_orders.variation_name}`}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">${sale.purchase_price.toFixed(2)}</span>
                    <StatusBadge status={sale.store_orders?.status} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-2.5">
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase mb-1.5">Vendedor</p>
                  <div className="flex items-center gap-2">
                    <Avatar src={sale.seller_profile?.avatar_url || undefined} name={sale.seller_profile?.full_name || sale.seller_profile?.username || 'V'} gradient="from-indigo-400 to-blue-500" size="sm" />
                    <span className="text-xs font-medium text-gray-900 dark:text-white truncate">{sale.seller_profile?.full_name || sale.seller_profile?.username || 'Loja Admin'}</span>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-2.5">
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase mb-1.5">Cliente</p>
                  <div className="flex items-center gap-2">
                    <Avatar src={sale.profiles?.avatar_url || undefined} name={sale.profiles?.username || sale.profiles?.full_name || 'C'} gradient="from-emerald-400 to-teal-500" size="sm" />
                    <span className="text-xs font-medium text-gray-900 dark:text-white truncate">{sale.profiles?.username || sale.profiles?.full_name || 'Cliente'}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {hasCoupon && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-300">
                    <Tag className="h-2.5 w-2.5" /> {sale.coupon?.code || 'Cupom'} -${Number(sale.store_orders!.discount_amount).toFixed(2)}
                  </span>
                )}
                {hasCashback && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                    <Coins className="h-2.5 w-2.5" /> Cashback -${Number(sale.store_orders!.cashback_used).toFixed(2)}
                  </span>
                )}
                {hasCommission && (
                  <>
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
                      <Percent className="h-2.5 w-2.5" /> Taxa ${Number(sale.commission!.admin_amount).toFixed(2)}
                    </span>
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                      <Wallet className="h-2.5 w-2.5" /> Lucro ${Number(sale.commission!.seller_amount).toFixed(2)}
                    </span>
                  </>
                )}
                {sale.store_products?.warranty_days != null && sale.store_products.warranty_days > 0 && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <ShieldCheck className="h-2.5 w-2.5" /> {sale.store_products.warranty_days}d garantia
                  </span>
                )}
                {sale.store_products?.delivery_time && (
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    <Clock3 className="h-2.5 w-2.5" /> {sale.store_products.delivery_time}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700/50">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(sale.purchase_date).toLocaleDateString('pt-BR')} {new Date(sale.purchase_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setSelectedSale(sale); setShowDetails(true); }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" /> Detalhes
                  </button>
                  {sale.store_orders?.status !== 'cancelled' && sale.store_orders?.status !== 'refunded' && (
                    <button onClick={() => { setSaleToCancel(sale); setShowCancellationModal(true); }}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5">
                      <XCircle className="h-3.5 w-3.5" /> Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Página <strong className="text-gray-900 dark:text-white">{currentPage}</strong> de {totalPages}
            <span className="text-gray-400 dark:text-gray-500"> · {startIndex + 1}-{Math.min(endIndex, filteredSales.length)} de {filteredSales.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="p-2 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) pageNum = i + 1;
                else if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;
                return (
                  <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 sm:w-9 h-8 sm:h-9 text-xs sm:text-sm font-medium rounded-xl transition-all ${
                      currentPage === pageNum ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}>{pageNum}</button>
                );
              })}
            </div>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              className="p-2 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredSales.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <ShoppingBag className="h-10 w-10 text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {hasActiveFilters ? 'Nenhuma venda encontrada' : 'Nenhuma venda realizada'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
            {hasActiveFilters ? 'Tente ajustar os filtros de busca para encontrar o que procura.' : 'As vendas aparecerão aqui quando os clientes começarem a comprar produtos.'}
          </p>
          {hasActiveFilters && (
            <button onClick={() => { setSearchTerm(''); setDateFilter('all'); setStatusFilter('all'); setCustomDateRange({ start: '', end: '' }); setShowCancelledSales(false); }}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors">
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Details Modal */}
      {showDetails && selectedSale && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start sm:items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-3xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Detalhes da Venda</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pedido #{selectedSale.order_id?.slice(0, 8)}</p>
                </div>
              </div>
              <button onClick={() => setShowDetails(false)} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Product Hero */}
              <div className="flex items-start gap-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-700/30 rounded-2xl p-4">
                <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                  {selectedSale.store_products?.image_url ? (
                    <img src={selectedSale.store_products.image_url} alt={selectedSale.product_name} className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Package className="h-8 w-8 text-gray-400" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">{selectedSale.product_name}</h4>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 capitalize">{selectedSale.store_products?.category || '—'}</span>
                    {selectedSale.store_orders?.variation_name && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{selectedSale.store_orders.variation_name}</span>
                    )}
                    {selectedSale.store_products?.is_featured && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-bold bg-gradient-to-r from-amber-400 to-yellow-500 text-white"><Star className="h-2.5 w-2.5 fill-current" /> Destaque</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {selectedSale.store_products?.warranty_days != null && selectedSale.store_products.warranty_days > 0 && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-3 w-3" /> {selectedSale.store_products.warranty_days} dias</span>
                    )}
                    {selectedSale.store_products?.delivery_time && (
                      <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {selectedSale.store_products.delivery_time}</span>
                    )}
                    {selectedSale.store_orders?.quantity && selectedSale.store_orders.quantity > 1 && (
                      <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> Qtd: {selectedSale.store_orders.quantity}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">${selectedSale.purchase_price.toFixed(2)}</p>
                  <div className="mt-1"><StatusBadge status={selectedSale.store_orders?.status} /></div>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-500" /> Composição Financeira</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3 border border-emerald-200 dark:border-emerald-800/30">
                    <div className="flex items-center gap-1.5 mb-1"><DollarSign className="h-3.5 w-3.5 text-emerald-500" /><span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">Valor Pago</span></div>
                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">${selectedSale.purchase_price.toFixed(2)}</p>
                  </div>
                  {selectedSale.store_orders?.discount_amount && Number(selectedSale.store_orders.discount_amount) > 0 && (
                    <div className="bg-pink-50 dark:bg-pink-500/10 rounded-xl p-3 border border-pink-200 dark:border-pink-800/30">
                      <div className="flex items-center gap-1.5 mb-1"><Tag className="h-3.5 w-3.5 text-pink-500" /><span className="text-[10px] font-semibold text-pink-700 dark:text-pink-400 uppercase">Desconto</span></div>
                      <p className="text-base font-bold text-pink-600 dark:text-pink-400">-${Number(selectedSale.store_orders.discount_amount).toFixed(2)}</p>
                      {selectedSale.coupon?.code && <p className="text-[10px] text-pink-500 mt-0.5">{selectedSale.coupon.code}</p>}
                    </div>
                  )}
                  {selectedSale.store_orders?.cashback_used && Number(selectedSale.store_orders.cashback_used) > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3 border border-amber-200 dark:border-amber-800/30">
                      <div className="flex items-center gap-1.5 mb-1"><Coins className="h-3.5 w-3.5 text-amber-500" /><span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase">Cashback</span></div>
                      <p className="text-base font-bold text-amber-600 dark:text-amber-400">-${Number(selectedSale.store_orders.cashback_used).toFixed(2)}</p>
                    </div>
                  )}
                  {selectedSale.commission && (
                    <>
                      <div className="bg-teal-50 dark:bg-teal-500/10 rounded-xl p-3 border border-teal-200 dark:border-teal-800/30">
                        <div className="flex items-center gap-1.5 mb-1"><Percent className="h-3.5 w-3.5 text-teal-500" /><span className="text-[10px] font-semibold text-teal-700 dark:text-teal-400 uppercase">Taxa Plataf.</span></div>
                        <p className="text-base font-bold text-teal-600 dark:text-teal-400">${Number(selectedSale.commission.admin_amount).toFixed(2)}</p>
                        <p className="text-[10px] text-teal-500 mt-0.5">{Number(selectedSale.commission.admin_commission_rate).toFixed(1)}%</p>
                      </div>
                      <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-xl p-3 border border-indigo-200 dark:border-indigo-800/30">
                        <div className="flex items-center gap-1.5 mb-1"><Wallet className="h-3.5 w-3.5 text-indigo-500" /><span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 uppercase">Lucro Vend.</span></div>
                        <p className="text-base font-bold text-indigo-600 dark:text-indigo-400">${Number(selectedSale.commission.seller_amount).toFixed(2)}</p>
                        <p className="text-[10px] text-indigo-500 mt-0.5">{Number(selectedSale.commission.seller_commission_rate).toFixed(1)}%</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Seller & Customer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-2xl p-4">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Store className="h-4 w-4 text-indigo-500" /> Vendedor</h4>
                  <div className="flex items-center gap-3">
                    <Avatar src={selectedSale.seller_profile?.avatar_url || undefined} name={selectedSale.seller_profile?.full_name || selectedSale.seller_profile?.username || 'V'} gradient="from-indigo-400 to-blue-500" size="lg" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedSale.seller_profile?.full_name || selectedSale.seller_profile?.username || 'Loja Admin'}</p>
                      {selectedSale.seller_profile?.seller_slug && <p className="text-xs text-gray-500 dark:text-gray-400">@{selectedSale.seller_profile.seller_slug}</p>}
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-2xl p-4">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><User className="h-4 w-4 text-emerald-500" /> Cliente</h4>
                  <div className="flex items-center gap-3">
                    <Avatar src={selectedSale.profiles?.avatar_url || undefined} name={selectedSale.profiles?.username || selectedSale.profiles?.full_name || selectedSale.profiles?.email || 'C'} gradient="from-emerald-400 to-teal-500" size="lg" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{selectedSale.profiles?.username || selectedSale.profiles?.full_name || selectedSale.store_orders?.customer_name || 'Cliente'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{selectedSale.profiles?.email || selectedSale.store_orders?.customer_email || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Info */}
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-2xl p-4">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Informações do Pedido</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Data da Compra</p>
                    <p className="text-gray-900 dark:text-white font-medium">{new Date(selectedSale.purchase_date).toLocaleDateString('pt-BR')} {new Date(selectedSale.purchase_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  {selectedSale.store_orders?.delivered_at && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Entregue em</p>
                      <p className="text-gray-900 dark:text-white font-medium">{new Date(selectedSale.store_orders.delivered_at).toLocaleDateString('pt-BR')} {new Date(selectedSale.store_orders.delivered_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">ID do Pedido</p>
                    <p className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all">{selectedSale.order_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">ID do Produto</p>
                    <p className="text-xs font-mono text-gray-600 dark:text-gray-400 break-all">{selectedSale.product_id}</p>
                  </div>
                  {selectedSale.store_orders?.cancelled_at && (
                    <div>
                      <p className="text-xs text-red-500 mb-0.5">Cancelado em</p>
                      <p className="text-red-600 dark:text-red-400 font-medium">{new Date(selectedSale.store_orders.cancelled_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  )}
                </div>
                {selectedSale.store_orders?.cancellation_reason && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800/30 rounded-xl">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Motivo do Cancelamento:</p>
                    <p className="text-sm text-red-600 dark:text-red-400">{selectedSale.store_orders.cancellation_reason}</p>
                  </div>
                )}
              </div>

              {/* Recharge Data */}
              {selectedSale.store_orders?.recharge_data && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800/30 rounded-2xl p-4">
                  <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2"><Zap className="h-4 w-4" /> Dados da Conta para Recarga</h4>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-amber-100 dark:border-gray-700 space-y-2">
                    <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" /><span className="font-mono text-sm text-gray-900 dark:text-white break-all">{selectedSale.store_orders.recharge_data.email}</span></div>
                    <div className="flex items-center gap-2"><Lock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" /><span className="font-mono text-sm text-gray-900 dark:text-white break-all">{selectedSale.store_orders.recharge_data.password}</span></div>
                    {selectedSale.store_orders.recharge_data.extra_data && (
                      <div className="flex items-start gap-2"><FileText className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" /><span className="text-sm text-gray-700 dark:text-gray-300 break-all">{selectedSale.store_orders.recharge_data.extra_data}</span></div>
                    )}
                    {selectedSale.store_orders?.status === 'paid' && !selectedSale.store_orders?.delivery_confirmed && (
                      <button onClick={() => handleConfirmDelivery(selectedSale.store_orders!.id || selectedSale.id)}
                        disabled={confirmingDelivery === (selectedSale.store_orders!.id || selectedSale.id)}
                        className="w-full mt-2 inline-flex items-center justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                        {confirmingDelivery === (selectedSale.store_orders!.id || selectedSale.id) ? (
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (<><Check className="h-4 w-4 mr-1.5" /> Confirmar Entrega</>)}
                      </button>
                    )}
                    {selectedSale.store_orders?.delivery_confirmed && (
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm font-medium pt-1"><CheckCircle className="h-4 w-4" /> Recarga entregue e confirmada</div>
                    )}
                  </div>
                </div>
              )}

              {/* Credentials */}
              <div className={`rounded-2xl p-4 border ${selectedSale.store_orders?.status === 'cancelled' ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-800/30' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-800/30'}`}>
                <h4 className={`text-sm font-bold mb-3 ${selectedSale.store_orders?.status === 'cancelled' ? 'text-red-800 dark:text-red-300' : 'text-emerald-800 dark:text-emerald-300'}`}>
                  {selectedSale.store_orders?.status === 'cancelled' ? 'Credenciais (Venda Cancelada)' : 'Credenciais Entregues'}
                </h4>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Email da Conta:</p>
                      <p className="font-mono text-sm text-gray-900 dark:text-white break-all">{selectedSale.credentials?.email || 'Não disponível'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Senha da Conta:</p>
                      <p className="font-mono text-sm text-gray-900 dark:text-white break-all">{selectedSale.credentials?.password || 'Não disponível'}</p>
                    </div>
                  </div>
                  {selectedSale.credentials?.instructions && (
                    <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Instruções:</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedSale.credentials.instructions}</p>
                    </div>
                  )}
                  {selectedSale.credentials && typeof selectedSale.credentials === 'object' && Object.keys(selectedSale.credentials).length > 0 && (
                    <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <details>
                        <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">Dados JSON completos</summary>
                        <pre className="mt-2 text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-700 overflow-x-auto">{JSON.stringify(selectedSale.credentials, null, 2)}</pre>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-2xl">
              {selectedSale.store_orders?.status !== 'cancelled' && selectedSale.store_orders?.status !== 'refunded' && (
                <button onClick={() => { setSaleToCancel(selectedSale); setShowDetails(false); setShowCancellationModal(true); }}
                  className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 text-sm font-semibold rounded-xl transition-colors flex items-center gap-2">
                  <XCircle className="h-4 w-4" /> Cancelar Venda
                </button>
              )}
              <button onClick={() => setShowDetails(false)}
                className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      <AdminSaleCancellationModal
        isOpen={showCancellationModal}
        onClose={() => { setShowCancellationModal(false); setSaleToCancel(null); }}
        sale={saleToCancel}
        onSuccess={() => { loadSales(); loadStats(); }}
      />
    </div>
  );
}
