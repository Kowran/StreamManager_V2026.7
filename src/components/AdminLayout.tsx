import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Gavel,
  DollarSign,
  CreditCard,
  ShoppingBag,
  Wallet,
  Tag,
  Package,
  Gamepad2,
  Server,
  TrendingUp,
  ShoppingCart,
  Store,
  Settings,
  Bell,
  AlertCircle,
  Megaphone,
  Image,
  Eye,
  Newspaper,
  MessageCircle,
  Scale,
  Mail,
  Globe,
  Shield,
  Search,
  ChevronDown,
  ChevronLeft,
  X,
  Home,
  type LucideIcon,
} from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';

interface AdminLayoutProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  children: React.ReactNode;
}

interface NavItem {
  id: string;
  name: string;
  icon: LucideIcon;
}

interface NavSection {
  id: string;
  title: string;
  titleEn: string;
  titleEs: string;
  icon: LucideIcon;
  items: NavItem[];
}

export function AdminLayout({ activeTab, onNavigate, children }: AdminLayoutProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [allowedPages, setAllowedPages] = useState<Set<string> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);

  const tr = (pt: string, en: string, es: string) => language === 'pt' ? pt : language === 'en' ? en : es;

  useEffect(() => {
    loadPermissions();
    loadPendingRequests();

    const channel = supabase
      .channel('admin-layout-seller-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seller_requests' }, () => {
        loadPendingRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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

  const loadPendingRequests = async () => {
    try {
      const { count } = await supabase
        .from('seller_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPendingRequests(count || 0);
    } catch { /* ignore */ }
  };

  const isAllowed = (pageId: string) => allowedPages === null || allowedPages.has(pageId);

  const sections: NavSection[] = useMemo(() => [
    {
      id: 'overview',
      title: 'Visão Geral',
      titleEn: 'Overview',
      titleEs: 'Vista General',
      icon: LayoutDashboard,
      items: [
        { id: 'admin-dashboard', name: tr('Painel', 'Dashboard', 'Panel'), icon: LayoutDashboard },
      ],
    },
    {
      id: 'users',
      title: 'Gestão de Usuários',
      titleEn: 'User Management',
      titleEs: 'Gestión de Usuarios',
      icon: Users,
      items: [
        { id: 'admin-users', name: tr('Gerenciar Usuários', 'Manage Users', 'Gestionar Usuarios'), icon: Users },
        { id: 'admin-appeals', name: tr('Recursos de Banimento', 'Ban Appeals', 'Apelaciones de Ban'), icon: Gavel },
        { id: 'accounts-access', name: tr('Acessos de Contas', 'Account Access', 'Acceso a Cuentas'), icon: UserCheck },
      ],
    },
    {
      id: 'finance',
      title: 'Gestão Financeira',
      titleEn: 'Financial Management',
      titleEs: 'Gestión Financiera',
      icon: DollarSign,
      items: [
        { id: 'admin-payments', name: tr('Confirmar Pagamentos', 'Confirm Payments', 'Confirmar Pagos'), icon: DollarSign },
        { id: 'admin-credits', name: tr('Gerenciar Créditos', 'Manage Credits', 'Gestionar Créditos'), icon: CreditCard },
        { id: 'admin-sales', name: tr('Gerenciar Vendas', 'Manage Sales', 'Gestionar Ventas'), icon: ShoppingBag },
        { id: 'admin-withdrawals', name: tr('Gestão de Saques', 'Withdrawals', 'Gestión de Retiros'), icon: Wallet },
        { id: 'admin-coupons', name: tr('Cupons de Desconto', 'Discount Coupons', 'Cupones de Descuento'), icon: Tag },
      ],
    },
    {
      id: 'products',
      title: 'Gestão de Produtos',
      titleEn: 'Product Management',
      titleEs: 'Gestión de Productos',
      icon: Package,
      items: [
        { id: 'admin-products', name: tr('Gerenciar Produtos', 'Manage Products', 'Gestionar Productos'), icon: Package },
        { id: 'admin-product-categories', name: tr('Categorias de Jogos', 'Game Categories', 'Categorías de Juegos'), icon: Gamepad2 },
        { id: 'admin-smm-providers', name: tr('Provedores SMM', 'SMM Providers', 'Proveedores SMM'), icon: Server },
        { id: 'admin-smm', name: tr('Configurar Serviços SMM', 'Configure SMM Services', 'Configurar Servicios SMM'), icon: TrendingUp },
        { id: 'admin-smm-orders', name: tr('Pedidos SMM', 'SMM Orders', 'Pedidos SMM'), icon: ShoppingCart },
        { id: 'sellers', name: t.sellers, icon: UserCheck },
        { id: 'admin-sellers-stores', name: tr('Lojas de Vendedores', 'Seller Stores', 'Tiendas de Vendedores'), icon: Store },
        { id: 'services', name: t.services, icon: Settings },
        { id: 'seller-requests', name: tr('Solicitações de Vendedores', 'Seller Requests', 'Solicitudes de Vendedores'), icon: Store },
      ],
    },
    {
      id: 'content',
      title: 'Conteúdo e Aparência',
      titleEn: 'Content & Appearance',
      titleEs: 'Contenido y Apariencia',
      icon: Image,
      items: [
        { id: 'admin-notifications', name: tr('Enviar Notificações', 'Send Notifications', 'Enviar Notificaciones'), icon: Bell },
        { id: 'admin-popups', name: tr('Gerenciar Pop-ups', 'Manage Popups', 'Gestionar Pop-ups'), icon: AlertCircle },
        { id: 'admin-announcements', name: tr('Anúncios', 'Announcements', 'Anuncios'), icon: Megaphone },
        { id: 'admin-banners', name: tr('Banners', 'Banners', 'Banners'), icon: Image },
        { id: 'admin-flying-balloons', name: tr('Balões Voadores', 'Flying Balloons', 'Globos Voladores'), icon: Eye },
        { id: 'admin-community', name: tr('Gerenciar Comunidade', 'Manage Community', 'Gestionar Comunidad'), icon: Newspaper },
      ],
    },
    {
      id: 'support',
      title: 'Suporte e Disputas',
      titleEn: 'Support & Disputes',
      titleEs: 'Soporte y Disputas',
      icon: MessageCircle,
      items: [
        { id: 'admin-support', name: tr('Gerenciar Suporte', 'Manage Support', 'Gestionar Soporte'), icon: MessageCircle },
        { id: 'admin-disputes', name: tr('Disputas e Mediação', 'Disputes & Mediation', 'Disputas y Mediación'), icon: Scale },
        { id: 'admin-netflix-accounts', name: tr('Contas Netflix', 'Netflix Accounts', 'Cuentas Netflix'), icon: Mail },
      ],
    },
    {
      id: 'system',
      title: 'Configurações do Sistema',
      titleEn: 'System Settings',
      titleEs: 'Configuraciones del Sistema',
      icon: Settings,
      items: [
        { id: 'admin-settings', name: tr('Configurações', 'Settings', 'Configuraciones'), icon: Settings },
        { id: 'admin-email-templates', name: tr('Modelos de Email', 'Email Templates', 'Plantillas de Email'), icon: Mail },
        { id: 'admin-discord', name: tr('Discord', 'Discord', 'Discord'), icon: MessageCircle },
        { id: 'admin-site-settings', name: tr('Identidade do Site', 'Site Identity', 'Identidad del Sitio'), icon: Globe },
        { id: 'admin-security', name: tr('Centro de Segurança', 'Security Center', 'Centro de Seguridad'), icon: Shield },
      ],
    },
  ], [language, t]);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections
      .map(section => ({
        ...section,
        items: section.items.filter(item => item.name.toLowerCase().includes(q)),
      }))
      .filter(section => section.items.length > 0);
  }, [sections, searchQuery]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const handleNavigate = (tab: string) => {
    onNavigate(tab);
    window.history.pushState(null, '', `/${tab}`);
    setMobileSidebarOpen(false);
  };

  const currentTitle = useMemo(() => {
    for (const section of sections) {
      const found = section.items.find(item => item.id === activeTab);
      if (found) return found.name;
    }
    return tr('Painel Admin', 'Admin Panel', 'Panel Admin');
  }, [sections, activeTab, language]);

  const sidebarContent = (
    <>
      {/* Sidebar header */}
      <div className="px-4 py-5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-2 rounded-xl shadow-lg shadow-blue-500/20">
            <LayoutDashboard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
              {tr('Painel Admin', 'Admin Panel', 'Panel Admin')}
            </h2>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              {tr('Centro de Controle', 'Control Center', 'Centro de Control')}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={tr('Buscar...', 'Search...', 'Buscar...')}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-gray-100 dark:bg-gray-700/50 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 transition-all focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin">
        {filteredSections.map((section) => {
          const visibleItems = section.items.filter(item => isAllowed(item.id));
          if (visibleItems.length === 0) return null;

          const isCollapsed = collapsedSections.has(section.id) && !searchQuery;
          const SectionIcon = section.icon;
          const hasActiveItem = visibleItems.some(item => item.id === activeTab);

          return (
            <div key={section.id} className="mb-1">
              <button
                onClick={() => toggleSection(section.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-colors ${
                  hasActiveItem
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                <SectionIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="flex-1 text-left">{tr(section.title, section.titleEn, section.titleEs)}</span>
                {searchQuery ? (
                  <ChevronDown className="h-3 w-3 opacity-50" />
                ) : isCollapsed ? (
                  <ChevronLeft className="h-3 w-3 rotate-90" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>

              {!isCollapsed && (
                <div className="mt-0.5 space-y-0.5">
                  {visibleItems.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = item.id === activeTab;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full flex items-center gap-2.5 pl-7 pr-2.5 py-2 text-sm rounded-lg transition-all group relative ${
                          isActive
                            ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/20'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                        }`}
                      >
                        <ItemIcon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                        <span className="flex-1 text-left truncate text-[13px]">{item.name}</span>
                        {item.id === 'seller-requests' && pendingRequests > 0 && (
                          <span className={`flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full ${
                            isActive ? 'bg-white text-blue-600' : 'bg-red-500 text-white'
                          }`}>
                            {pendingRequests}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Back to store */}
      <div className="px-2 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <button
          onClick={() => {
            handleNavigate('store');
            window.history.pushState(null, '', '/');
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
        >
          <Home className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <span className="text-[13px]">{tr('Voltar à Loja', 'Back to Store', 'Volver a la Tienda')}</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex gap-0 -m-2 sm:-m-4 lg:-m-6 min-h-[calc(100vh-200px)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col rounded-l-lg overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <aside
            className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-gray-800 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 z-10"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 rounded-r-lg">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronDown className="h-5 w-5 rotate-90" />
          </button>
          <h1 className="text-base font-bold text-gray-900 dark:text-white truncate">{currentTitle}</h1>
        </div>

        {/* Desktop breadcrumb */}
        <div className="hidden lg:flex items-center gap-2 px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 rounded-r-lg">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">{currentTitle}</h1>
        </div>

        {/* Content area */}
        <div className="flex-1 p-4 sm:p-6 bg-gray-50 dark:bg-gray-900/50 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
