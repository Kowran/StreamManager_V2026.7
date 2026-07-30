import React, { useState, useEffect } from 'react';
import {
  Users,
  ShoppingBag,
  DollarSign,
  Package,
  TrendingUp,
  AlertCircle,
  Bell,
  Wallet,
  Store,
  MessageCircle,
  Scale,
  Shield,
  ArrowRight,
  Activity,
  UserCheck,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
}

interface StatCard {
  id: string;
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  page: string;
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [stats, setStats] = useState<Record<string, number>>({});
  const [allowedPages, setAllowedPages] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);

  const tr = (pt: string, en: string, es: string) => language === 'pt' ? pt : language === 'en' ? en : es;

  useEffect(() => {
    loadPermissions();
    loadStats();
  }, [user]);

  const loadPermissions = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('admin_permissions')
        .select('pages, is_super_admin')
        .eq('admin_user_id', user.id)
        .maybeSingle();
      if (!data || data.is_super_admin) {
        setAllowedPages(null);
      } else {
        setAllowedPages(new Set(data.pages));
      }
    } catch {
      setAllowedPages(null);
    }
  };

  const loadStats = async () => {
    try {
      const [users, products, sales, pendingPay, pendingReq, pendingSup, pendingDisp] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('store_products').select('*', { count: 'exact', head: true }),
        supabase.from('store_orders').select('*', { count: 'exact', head: true }),
        supabase.from('store_orders').select('*', { count: 'exact', head: true }).eq('payment_status', 'pending'),
        supabase.from('seller_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('seller_support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'disputed'),
      ]);

      setStats({
        users: users.count || 0,
        products: products.count || 0,
        sales: sales.count || 0,
        pendingPayments: pendingPay.count || 0,
        pendingRequests: pendingReq.count || 0,
        pendingSupport: pendingSup.count || 0,
        pendingDisputes: pendingDisp.count || 0,
      });
    } catch { /* ignore */ }
    setLoading(false);
  };

  const isAllowed = (pageId: string) => allowedPages === null || allowedPages.has(pageId);

  const statCards: StatCard[] = [
    { id: 'users', label: tr('Usuários', 'Users', 'Usuarios'), value: stats.users, icon: Users, color: 'text-blue-600', bgColor: 'from-blue-500 to-blue-600', page: 'admin-users' },
    { id: 'products', label: tr('Produtos', 'Products', 'Productos'), value: stats.products, icon: Package, color: 'text-indigo-600', bgColor: 'from-indigo-500 to-indigo-600', page: 'admin-products' },
    { id: 'sales', label: tr('Vendas', 'Sales', 'Ventas'), value: stats.sales, icon: ShoppingBag, color: 'text-orange-600', bgColor: 'from-orange-500 to-orange-600', page: 'admin-sales' },
    { id: 'payments', label: tr('Pagamentos Pendentes', 'Pending Payments', 'Pagos Pendientes'), value: stats.pendingPayments, icon: DollarSign, color: 'text-green-600', bgColor: 'from-green-500 to-green-600', page: 'admin-payments' },
  ];

  const alerts = [
    { id: 'req', label: tr('Solicitações de Vendedores', 'Seller Requests', 'Solicitudes de Vendedores'), value: stats.pendingRequests, icon: Store, page: 'seller-requests', color: 'amber' },
    { id: 'sup', label: tr('Tickets de Suporte', 'Support Tickets', 'Tickets de Soporte'), value: stats.pendingSupport, icon: MessageCircle, page: 'admin-support', color: 'blue' },
    { id: 'disp', label: tr('Disputas Abertas', 'Open Disputes', 'Disputas Abiertas'), value: stats.pendingDisputes, icon: Scale, page: 'admin-disputes', color: 'red' },
  ].filter(a => a.value > 0 && isAllowed(a.page));

  const quickActions: { id: string; name: string; icon: LucideIcon; color: string; page: string }[] = [
    { id: 'admin-users', name: tr('Usuários', 'Users', 'Usuarios'), icon: Users, color: 'blue', page: 'admin-users' },
    { id: 'admin-products', name: tr('Produtos', 'Products', 'Productos'), icon: Package, color: 'indigo', page: 'admin-products' },
    { id: 'admin-sales', name: tr('Vendas', 'Sales', 'Ventas'), icon: ShoppingBag, color: 'orange', page: 'admin-sales' },
    { id: 'admin-payments', name: tr('Pagamentos', 'Payments', 'Pagos'), icon: DollarSign, color: 'green', page: 'admin-payments' },
    { id: 'admin-withdrawals', name: tr('Saques', 'Withdrawals', 'Retiros'), icon: Wallet, color: 'cyan', page: 'admin-withdrawals' },
    { id: 'admin-notifications', name: tr('Notificações', 'Notifications', 'Notificaciones'), icon: Bell, color: 'purple', page: 'admin-notifications' },
    { id: 'admin-support', name: tr('Suporte', 'Support', 'Soporte'), icon: MessageCircle, color: 'yellow', page: 'admin-support' },
    { id: 'admin-security', name: tr('Segurança', 'Security', 'Seguridad'), icon: Shield, color: 'emerald', page: 'admin-security' },
  ].filter(a => isAllowed(a.page));

  const colorMap: Record<string, string> = {
    blue: 'hover:border-blue-400 hover:shadow-blue-500/10 text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    indigo: 'hover:border-indigo-400 hover:shadow-indigo-500/10 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20',
    orange: 'hover:border-orange-400 hover:shadow-orange-500/10 text-orange-600 bg-orange-50 dark:bg-orange-900/20',
    green: 'hover:border-green-400 hover:shadow-green-500/10 text-green-600 bg-green-50 dark:bg-green-900/20',
    cyan: 'hover:border-cyan-400 hover:shadow-cyan-500/10 text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20',
    purple: 'hover:border-purple-400 hover:shadow-purple-500/10 text-purple-600 bg-purple-50 dark:bg-purple-900/20',
    yellow: 'hover:border-yellow-400 hover:shadow-yellow-500/10 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
    emerald: 'hover:border-emerald-400 hover:shadow-emerald-500/10 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-700/50',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700/50',
  };

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-700 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-5 w-5 text-blue-200" />
            <span className="text-sm font-medium text-blue-100">{tr('Bem-vindo de volta', 'Welcome back', 'Bienvenido de nuevo')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">
            {tr('Painel Administrativo', 'Admin Panel', 'Panel Administrativo')}
          </h1>
          <p className="text-blue-100 text-sm sm:text-base">
            {tr('Acompanhe e gerencie todo o sistema em um só lugar', 'Track and manage the entire system in one place', 'Rastrea y gestiona todo el sistema en un solo lugar')}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          if (!isAllowed(card.page)) return null;
          return (
            <button
              key={card.id}
              onClick={() => onNavigate(card.page)}
              className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 text-left hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`bg-gradient-to-br ${card.bgColor} p-2.5 rounded-lg shadow-sm`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                {loading ? '...' : card.value.toLocaleString()}
              </div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                {card.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {tr('Atenção Necessária', 'Needs Attention', 'Requiere Atención')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {alerts.map((alert) => {
              const Icon = alert.icon;
              return (
                <button
                  key={alert.id}
                  onClick={() => onNavigate(alert.page)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all hover:shadow-md ${colorMap[alert.color]}`}
                >
                  <div className={`p-2 rounded-lg ${colorMap[alert.color].split(' ').find(c => c.startsWith('bg-'))}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-lg font-bold leading-tight">{alert.value}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{alert.label}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {tr('Acesso Rápido', 'Quick Access', 'Acceso Rápido')}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const colors = colorMap[action.color];
            return (
              <button
                key={action.id}
                onClick={() => onNavigate(action.id)}
                className="group flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-transparent transition-all hover:-translate-y-0.5"
              >
                <div className={`p-2.5 rounded-lg ${colors.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('text-')).join(' ')}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                  {action.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
