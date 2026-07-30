import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, MessageCircle, Wallet,
  HelpCircle, Settings as SettingsIcon, Award, Store, AlertTriangle,
  Loader2, Ban, Search, Menu, X, ChevronRight, TrendingUp, Zap,
  ArrowRight, Sparkles, Inbox, Clock, CheckCircle2, Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { SellerDashboardOverview } from './SellerDashboardOverview';
import { SellerProductsManager } from './SellerProductsManager';
import { SellerOrdersManager } from './SellerOrdersManager';
import { SellerSupport } from './SellerSupport';
import { SellerBalanceDetail } from './SellerBalanceDetail';
import { SellerQAManager } from './SellerQAManager';
import { SellerSettings } from './SellerSettings';
import { SellerReputation } from './SellerReputation';

type SellerTab =
  | 'dashboard' | 'products' | 'orders' | 'qa'
  | 'support' | 'balance' | 'settings' | 'reputation';

interface NavItem {
  id: SellerTab;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const VALID_TABS: SellerTab[] = [
  'dashboard', 'products', 'orders', 'qa',
  'support', 'balance', 'settings', 'reputation',
];

function parseTabFromUrl(): SellerTab {
  const path = window.location.pathname.slice(1);
  if (path.startsWith('seller-store/')) {
    const sub = path.split('/')[1] as SellerTab;
    if (VALID_TABS.includes(sub)) return sub;
  }
  return 'dashboard';
}

export function SellerStore() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<SellerTab>(() => parseTabFromUrl());
  const [isSeller, setIsSeller] = useState(false);
  const [storeSuspended, setStoreSuspended] = useState(false);
  const [sellerName, setSellerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const [pendingQuestionsCount, setPendingQuestionsCount] = useState(0);
  const [vacationMode, setVacationMode] = useState(false);
  const [productCount, setProductCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);

  const lbl = useCallback((pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es, [language]);

  useEffect(() => {
    checkSellerStatus();
    // Restore sub-tab from URL on back/forward
    const handlePop = () => setActiveTab(parseTabFromUrl());
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  useEffect(() => {
    if (isSeller && user && !storeSuspended) {
      loadCounts();
      loadVacationMode();
      loadStoreStats();
    }
  }, [isSeller, user, storeSuspended]);

  async function checkSellerStatus() {
    if (!user) return;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, store_suspended, full_name, username')
        .eq('id', user.id)
        .maybeSingle();
      const isSellerRole = profile?.role === 'seller' || profile?.role === 'admin';
      setIsSeller(isSellerRole);
      setStoreSuspended(!!profile?.store_suspended && profile?.role === 'seller');
      setSellerName(profile?.full_name || profile?.username || '');
    } catch {
      setIsSeller(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadCounts() {
    if (!user) return;
    try {
      const [ordersRes, ticketsRes, questionsRes] = await Promise.all([
        supabase.from('store_orders').select('*', { count: 'exact', head: true })
          .eq('seller_id', user.id).in('status', ['pending', 'paid', 'processing']),
        supabase.from('seller_support_tickets').select('*', { count: 'exact', head: true })
          .eq('seller_id', user.id).in('status', ['open', 'waiting_seller']),
        supabase.from('product_questions').select('*', { count: 'exact', head: true })
          .eq('seller_id', user.id).is('answer', null),
      ]);
      setPendingOrdersCount(ordersRes.count || 0);
      setOpenTicketsCount(ticketsRes.count || 0);
      setPendingQuestionsCount(questionsRes.count || 0);
    } catch { /* ignore */ }
  }

  async function loadVacationMode() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('seller_store_settings')
        .select('vacation_mode')
        .eq('seller_id', user.id)
        .maybeSingle();
      setVacationMode(data?.vacation_mode || false);
    } catch { /* ignore */ }
  }

  async function loadStoreStats() {
    if (!user) return;
    try {
      const [prodRes, ordersRes] = await Promise.all([
        supabase.from('store_products').select('*', { count: 'exact', head: true })
          .eq('seller_id', user.id),
        supabase.from('store_orders').select('total_price, quantity')
          .eq('seller_id', user.id).eq('status', 'completed'),
      ]);
      setProductCount(prodRes.count || 0);
      const orders = ordersRes.data || [];
      setTotalOrders(orders.length);
      setTotalRevenue(orders.reduce((sum, o) => sum + (o.total_price || 0), 0));
    } catch { /* ignore */ }
  }

  const sellerNavigate = useCallback((tab: SellerTab) => {
    setActiveTab(tab);
    window.history.pushState(null, '', `/seller-store/${tab}`);
    setSidebarOpen(false);
  }, []);

  const navGroups: NavGroup[] = useMemo(() => {
    const I = (id: SellerTab, name: string, icon: React.ComponentType<{ className?: string }>, description: string, badge?: number): NavItem =>
      ({ id, name, icon, description, badge });

    return [
      {
        title: lbl('Principal', 'Main', 'Principal'),
        items: [
          I('dashboard', lbl('Dashboard', 'Dashboard', 'Panel'), LayoutDashboard,
            lbl('Visão geral da loja', 'Store overview', 'Resumen de tienda')),
          I('products', lbl('Produtos', 'Products', 'Productos'), Package,
            lbl('Gerencie seus produtos', 'Manage your products', 'Gestiona tus productos')),
          I('orders', lbl('Pedidos', 'Orders', 'Pedidos'), ShoppingCart,
            lbl('Acompanhe e gerencie vendas', 'Track and manage sales', 'Sigue y gestiona ventas'),
            pendingOrdersCount),
        ],
      },
      {
        title: lbl('Comunicação', 'Communication', 'Comunicación'),
        items: [
          I('qa', lbl('Perguntas', 'Q&A', 'Preguntas'), HelpCircle,
            lbl('Responda perguntas dos clientes', 'Answer customer questions', 'Responde preguntas'),
            pendingQuestionsCount),
          I('support', lbl('Suporte', 'Support', 'Soporte'), MessageCircle,
            lbl('Tickets de suporte', 'Support tickets', 'Tickets de soporte'),
            openTicketsCount),
        ],
      },
      {
        title: lbl('Financeiro', 'Financial', 'Financiero'),
        items: [
          I('balance', lbl('Saldo & Saques', 'Balance & Withdrawals', 'Saldo y Retiros'), Wallet,
            lbl('Saldo, saques e comissões', 'Balance, withdrawals, commissions', 'Saldo, retiros, comisiones')),
        ],
      },
      {
        title: lbl('Configurações', 'Settings', 'Configuración'),
        items: [
          I('reputation', lbl('Reputação', 'Reputation', 'Reputación'), Award,
            lbl('Avaliações e nível', 'Ratings and level', 'Valoraciones y nivel')),
          I('settings', lbl('Configurações', 'Settings', 'Configuración'), SettingsIcon,
            lbl('Perfil, automação e políticas', 'Profile, automation, policies', 'Perfil, automatización, políticas')),
        ],
      },
    ];
  }, [language, lbl, pendingOrdersCount, pendingQuestionsCount, openTicketsCount]);

  const allItems = navGroups.flatMap(g => g.items);
  const activeItem = allItems.find(i => i.id === activeTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-400">{lbl('Carregando loja...', 'Loading store...', 'Cargando tienda...')}</p>
        </div>
      </div>
    );
  }

  if (!isSeller) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center mx-auto mb-5 shadow-sm">
            <Store className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {lbl('Acesso Restrito', 'Restricted Access', 'Acceso Restringido')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {lbl(
              'Apenas vendedores aprovados podem gerenciar sua loja. Solicite seu acesso como vendedor para começar a vender.',
              'Only approved sellers can manage their store. Apply for seller access to start selling.',
              'Solo vendedores aprobados pueden gestionar su tienda. Solicita acceso como vendedor para empezar a vender.'
            )}
          </p>
        </div>
      </div>
    );
  }

  if (storeSuspended) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center max-w-lg">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 flex items-center justify-center mx-auto mb-5 shadow-sm">
            <Ban className="h-10 w-10 text-red-500 dark:text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {lbl('Loja Suspensa', 'Store Suspended', 'Tienda Suspendida')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {lbl(
              'Sua loja foi suspensa pela administração. Você não pode criar, editar ou vender produtos no momento, mas pode continuar comprando de outros vendedores. Entre em contato com o suporte para mais informações.',
              'Your store has been suspended by administration. You cannot create, edit, or sell products at the moment, but you can still buy from other sellers. Contact support for more information.',
              'Tu tienda ha sido suspendida por la administración. No puedes crear, editar ni vender productos en este momento, pero puedes seguir comprando a otros vendedores. Contacta con soporte para más información.'
            )}
          </p>
        </div>
      </div>
    );
  }

  function renderTab() {
    switch (activeTab) {
      case 'dashboard': return <SellerDashboardOverview onNavigate={(tab) => sellerNavigate(tab as SellerTab)} />;
      case 'products': return <SellerProductsManager />;
      case 'orders': return <SellerOrdersManager />;
      case 'qa': return <SellerQAManager />;
      case 'support': return <SellerSupport />;
      case 'balance': return <SellerBalanceDetail />;
      case 'settings': return <SellerSettings />;
      case 'reputation': return <SellerReputation sellerId={user!.id} sellerName={sellerName} />;
    }
  }

  const totalBadge = pendingOrdersCount + openTicketsCount + pendingQuestionsCount;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-72 flex-shrink-0
        bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        flex flex-col
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Sidebar header */}
        <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
              <Store className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {lbl('Minha Loja', 'My Store', 'Mi Tienda')}
              </h2>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                {sellerName || user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Vacation mode banner */}
        {vacationMode && (
          <div className="mx-3 mt-3 flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              {lbl('Modo Férias Ativo', 'Vacation Mode Active', 'Modo Vacaciones Activo')}
            </span>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {navGroups.map(group => (
            <div key={group.title}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => sellerNavigate(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all group ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold shadow-sm shadow-blue-500/20'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 ${
                        isActive ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'
                      }`}>
                        <item.icon className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                      </div>
                      <span className="flex-1 text-left truncate">{item.name}</span>
                      {!!item.badge && item.badge > 0 && (
                        <span className={`flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                          isActive ? 'bg-white text-blue-600' : 'bg-red-500 text-white'
                        }`}>
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar footer — mini stats */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex-shrink-0">
          <div className="grid grid-cols-3 gap-2">
            <MiniStat icon={Package} value={productCount} label={lbl('Prod', 'Prod', 'Prod')} />
            <MiniStat icon={ShoppingCart} value={totalOrders} label={lbl('Vend', 'Sold', 'Vend')} />
            <MiniStat icon={TrendingUp} value={`$${totalRevenue.toFixed(0)}`} label={lbl('Receita', 'Revenue', 'Ingr')} />
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5">
              {activeItem && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <activeItem.icon className="h-4 w-4 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  {activeItem?.name || lbl('Dashboard', 'Dashboard', 'Panel')}
                </h1>
                <p className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
                  {activeItem?.description}
                </p>
              </div>
            </div>
          </div>
          {totalBadge > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <Inbox className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                {totalBadge} {lbl('pendências', 'pending', 'pendientes')}
              </span>
            </div>
          )}
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Desktop quick-nav strip for dashboard */}
          {activeTab === 'dashboard' && (
            <div className="hidden sm:block border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 px-6 py-3">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                <QuickNav icon={Package} label={lbl('Produtos', 'Products', 'Productos')} onClick={() => sellerNavigate('products')} />
                <QuickNav icon={ShoppingCart} label={lbl('Pedidos', 'Orders', 'Pedidos')} onClick={() => sellerNavigate('orders')} badge={pendingOrdersCount} />
                <QuickNav icon={HelpCircle} label={lbl('Perguntas', 'Q&A', 'Preguntas')} onClick={() => sellerNavigate('qa')} badge={pendingQuestionsCount} />
                <QuickNav icon={MessageCircle} label={lbl('Suporte', 'Support', 'Soporte')} onClick={() => sellerNavigate('support')} badge={openTicketsCount} />
                <QuickNav icon={Wallet} label={lbl('Saldo', 'Balance', 'Saldo')} onClick={() => sellerNavigate('balance')} />
                <QuickNav icon={SettingsIcon} label={lbl('Config', 'Settings', 'Config')} onClick={() => sellerNavigate('settings')} />
              </div>
            </div>
          )}
          <div className="p-4 sm:p-6 lg:p-8">
            {renderTab()}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, value, label }: {
  icon: React.ComponentType<{ className?: string }>;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 py-2">
      <Icon className="h-3.5 w-3.5 text-gray-400" />
      <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{value}</span>
      <span className="text-[9px] text-gray-400">{label}</span>
    </div>
  );
}

function QuickNav({ icon: Icon, label, onClick, badge }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap text-sm font-medium"
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span>{label}</span>
      {!!badge && badge > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}
