import React, { useState, useEffect } from 'react';
import {
  Users,
  Settings,
  MessageCircle,
  DollarSign,
  ShoppingBag,
  UserCheck,
  Package,
  TrendingUp,
  CreditCard,
  BarChart3,
  Server,
  ShoppingCart,
  Newspaper,
  Store,
  Mail,
  Bell,
  AlertCircle,
  Megaphone,
  Image,
  Tag,
  Eye,
  Wallet,
  Globe,
  Scale,
  Gamepad2,
  Gavel
} from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState(0);
  const [allowedPages, setAllowedPages] = useState<Set<string> | null>(null);

  useEffect(() => {
    loadPendingRequests();
    loadPermissions();

    const channel = supabase
      .channel('seller-requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seller_requests' }, () => {
        loadPendingRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadPendingRequests = async () => {
    try {
      const { count, error } = await supabase
        .from('seller_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      setPendingRequests(count || 0);
    } catch { /* ignore */ }
  };

  const loadPermissions = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('admin_permissions')
        .select('pages, is_super_admin')
        .eq('admin_user_id', user.id)
        .maybeSingle();

      // No row = full access (backward compat for first admin)
      if (!data || data.is_super_admin) {
        setAllowedPages(null); // null = all allowed
      } else {
        setAllowedPages(new Set(data.pages));
      }
    } catch {
      setAllowedPages(null);
    }
  };

  const isAllowed = (pageId: string) => allowedPages === null || allowedPages.has(pageId);

  const adminSections = [
    {
      title: language === 'pt' ? 'Gestão de Usuários' : language === 'en' ? 'User Management' : 'Gestión de Usuarios',
      items: [
        { id: 'admin-users', name: language === 'pt' ? 'Gerenciar Usuários' : language === 'en' ? 'Manage Users' : 'Gestionar Usuarios', icon: Users, color: 'from-blue-500 to-blue-600', description: language === 'pt' ? 'Visualize e gerencie todos os usuários' : language === 'en' ? 'View and manage all users' : 'Ver y gestionar todos los usuarios' },
        { id: 'admin-appeals', name: language === 'pt' ? 'Recursos de Banimento' : language === 'en' ? 'Ban Appeals' : 'Apelaciones de Ban', icon: Gavel, color: 'from-rose-500 to-red-600', description: language === 'pt' ? 'Revise recursos de usuários banidos' : language === 'en' ? 'Review banned user appeals' : 'Revisar apelaciones de usuarios baneados' },
        { id: 'accounts-access', name: language === 'pt' ? 'Acessos de Contas' : language === 'en' ? 'Account Access' : 'Acceso a Cuentas', icon: UserCheck, color: 'from-purple-500 to-purple-600', description: language === 'pt' ? 'Gerencie acessos de contas' : language === 'en' ? 'Manage account access' : 'Gestionar acceso a cuentas' }
      ]
    },
    {
      title: language === 'pt' ? 'Gestão Financeira' : language === 'en' ? 'Financial Management' : 'Gestión Financiera',
      items: [
        { id: 'admin-payments', name: language === 'pt' ? 'Confirmar Pagamentos' : language === 'en' ? 'Confirm Payments' : 'Confirmar Pagos', icon: DollarSign, color: 'from-green-500 to-green-600', description: language === 'pt' ? 'Confirme pagamentos pendentes' : language === 'en' ? 'Confirm pending payments' : 'Confirmar pagos pendientes' },
        { id: 'admin-credits', name: language === 'pt' ? 'Gerenciar Créditos' : language === 'en' ? 'Manage Credits' : 'Gestionar Créditos', icon: CreditCard, color: 'from-emerald-500 to-emerald-600', description: language === 'pt' ? 'Adicione ou remova créditos' : language === 'en' ? 'Add or remove credits' : 'Agregar o quitar créditos' },
        { id: 'admin-sales', name: language === 'pt' ? 'Gerenciar Vendas' : language === 'en' ? 'Manage Sales' : 'Gestionar Ventas', icon: ShoppingBag, color: 'from-orange-500 to-orange-600', description: language === 'pt' ? 'Visualize e gerencie vendas' : language === 'en' ? 'View and manage sales' : 'Ver y gestionar ventas' },
        { id: 'admin-withdrawals', name: language === 'pt' ? 'Gestão de Saques' : language === 'en' ? 'Withdrawal Management' : 'Gestión de Retiros', icon: Wallet, color: 'from-cyan-500 to-blue-600', description: language === 'pt' ? 'Aprove e processe saques de vendedores' : language === 'en' ? 'Approve and process seller withdrawals' : 'Aprobar y procesar retiros de vendedores' },
        { id: 'admin-coupons', name: language === 'pt' ? 'Cupons de Desconto' : language === 'en' ? 'Discount Coupons' : 'Cupones de Descuento', icon: Tag, color: 'from-rose-500 to-rose-600', description: language === 'pt' ? 'Crie cupons de desconto para clientes' : language === 'en' ? 'Create discount coupons for customers' : 'Cree cupones de descuento para clientes' }
      ]
    },
    {
      title: language === 'pt' ? 'Gestão de Produtos' : language === 'en' ? 'Product Management' : 'Gestión de Productos',
      items: [
        { id: 'admin-products', name: language === 'pt' ? 'Gerenciar Produtos' : language === 'en' ? 'Manage Products' : 'Gestionar Productos', icon: Package, color: 'from-indigo-500 to-indigo-600', description: language === 'pt' ? 'Gerencie produtos da loja' : language === 'en' ? 'Manage store products' : 'Gestionar productos de la tienda' },
        { id: 'admin-product-categories', name: language === 'pt' ? 'Categorias de Jogos' : language === 'en' ? 'Game Categories' : 'Categorías de Juegos', icon: Gamepad2, color: 'from-fuchsia-500 to-fuchsia-600', description: language === 'pt' ? 'Crie categorias (Clash, Fortnite, Minecraft)' : language === 'en' ? 'Create categories (Clash, Fortnite, Minecraft)' : 'Crea categorías (Clash, Fortnite, Minecraft)' },
        { id: 'admin-smm-providers', name: language === 'pt' ? 'Provedores SMM' : language === 'en' ? 'SMM Providers' : 'Proveedores SMM', icon: Server, color: 'from-blue-500 to-cyan-600', description: language === 'pt' ? 'Configure APIs e importe serviços' : language === 'en' ? 'Configure APIs and import services' : 'Configure APIs e importe servicios' },
        { id: 'admin-smm', name: language === 'pt' ? 'Configurar Serviços SMM' : language === 'en' ? 'Configure SMM Services' : 'Configurar Servicios SMM', icon: TrendingUp, color: 'from-teal-500 to-teal-600', description: language === 'pt' ? 'Gerencie serviços e preços SMM' : language === 'en' ? 'Manage SMM services and prices' : 'Gestionar servicios y precios SMM' },
        { id: 'admin-smm-orders', name: language === 'pt' ? 'Pedidos SMM' : language === 'en' ? 'SMM Orders' : 'Pedidos SMM', icon: ShoppingCart, color: 'from-violet-500 to-violet-600', description: language === 'pt' ? 'Visualize pedidos SMM dos usuários' : language === 'en' ? 'View user SMM orders' : 'Ver pedidos SMM de usuarios' },
        { id: 'sellers', name: t.sellers, icon: UserCheck, color: 'from-cyan-500 to-cyan-600', description: language === 'pt' ? 'Gerencie vendedores' : language === 'en' ? 'Manage sellers' : 'Gestionar vendedores' },
        { id: 'services', name: t.services, icon: Settings, color: 'from-pink-500 to-pink-600', description: language === 'pt' ? 'Configure serviços disponíveis' : language === 'en' ? 'Configure available services' : 'Configurar servicios disponibles' },
        { id: 'seller-requests', name: language === 'pt' ? 'Solicitações de Vendedores' : language === 'en' ? 'Seller Requests' : 'Solicitudes de Vendedores', icon: Store, color: 'from-blue-500 to-blue-600', description: language === 'pt' ? 'Aprove ou rejeite solicitações' : language === 'en' ? 'Approve or reject requests' : 'Aprobar o rechazar solicitudes' }
      ]
    },
    {
      title: language === 'pt' ? 'Suporte e Configurações' : language === 'en' ? 'Support & Settings' : 'Soporte y Configuración',
      items: [
        { id: 'admin-notifications', name: language === 'pt' ? 'Enviar Notificações' : language === 'en' ? 'Send Notifications' : 'Enviar Notificaciones', icon: Bell, color: 'from-purple-500 to-pink-600', description: language === 'pt' ? 'Envie notificações para usuários' : language === 'en' ? 'Send notifications to users' : 'Enviar notificaciones a usuarios' },
        { id: 'admin-popups', name: language === 'pt' ? 'Gerenciar Pop-ups' : language === 'en' ? 'Manage Popups' : 'Gestionar Pop-ups', icon: AlertCircle, color: 'from-orange-500 to-red-600', description: language === 'pt' ? 'Crie alertas e pop-ups para usuários' : language === 'en' ? 'Create alerts and popups for users' : 'Crear alertas y pop-ups para usuarios' },
        { id: 'admin-announcements', name: language === 'pt' ? 'Anúncios' : language === 'en' ? 'Announcements' : 'Anuncios', icon: Megaphone, color: 'from-blue-500 to-cyan-600', description: language === 'pt' ? 'Crie barras de aviso acima do cabeçalho' : language === 'en' ? 'Create announcement bars above the header' : 'Cree barras de aviso sobre el encabezado' },
        { id: 'admin-banners', name: language === 'pt' ? 'Banners' : language === 'en' ? 'Banners' : 'Banners', icon: Image, color: 'from-purple-500 to-pink-600', description: language === 'pt' ? 'Banners rotativos da página inicial' : language === 'en' ? 'Rotating banners on the landing page' : 'Banners rotativos de la página principal' },
        { id: 'admin-flying-balloons', name: language === 'pt' ? 'Balões Voadores' : language === 'en' ? 'Flying Balloons' : 'Globos Voladores', icon: Eye, color: 'from-teal-500 to-emerald-600', description: language === 'pt' ? 'Balões flutuantes no canto da tela' : language === 'en' ? 'Floating balloons in the screen corner' : 'Globos flotantes en la esquina de la pantalla' },
        { id: 'admin-community', name: language === 'pt' ? 'Gerenciar Comunidade' : language === 'en' ? 'Manage Community' : 'Gestionar Comunidad', icon: Newspaper, color: 'from-blue-500 to-cyan-600', description: language === 'pt' ? 'Poste novidades para os usuários' : language === 'en' ? 'Post news for users' : 'Publicar novedades para usuarios' },
        { id: 'admin-support', name: language === 'pt' ? 'Gerenciar Suporte' : language === 'en' ? 'Manage Support' : 'Gestionar Soporte', icon: MessageCircle, color: 'from-yellow-500 to-yellow-600', description: language === 'pt' ? 'Responda tickets de suporte' : language === 'en' ? 'Respond to support tickets' : 'Responder tickets de soporte' },
        { id: 'admin-disputes', name: language === 'pt' ? 'Disputas e Mediação' : language === 'en' ? 'Disputes & Mediation' : 'Disputas y Mediación', icon: Scale, color: 'from-red-500 to-orange-600', description: language === 'pt' ? 'Medie disputas entre clientes e vendedores' : language === 'en' ? 'Mediate disputes between customers and sellers' : 'Mediar disputas entre clientes y vendedores' },
        { id: 'admin-netflix-accounts', name: language === 'pt' ? 'Contas Netflix' : language === 'en' ? 'Netflix Accounts' : 'Cuentas Netflix', icon: Mail, color: 'from-red-500 to-red-600', description: language === 'pt' ? 'Configure contas para buscar códigos' : language === 'en' ? 'Configure accounts to find codes' : 'Configure cuentas para buscar códigos' },
        { id: 'admin-settings', name: language === 'pt' ? 'Configurações' : language === 'en' ? 'Settings' : 'Configuraciones', icon: Settings, color: 'from-gray-500 to-gray-600', description: language === 'pt' ? 'Configure o sistema' : language === 'en' ? 'Configure the system' : 'Configurar el sistema' },
        { id: 'admin-email-templates', name: language === 'pt' ? 'Modelos de Email' : language === 'en' ? 'Email Templates' : 'Plantillas de Email', icon: Mail, color: 'from-emerald-500 to-teal-600', description: language === 'pt' ? 'Edite os modelos HTML de email' : language === 'en' ? 'Edit email HTML templates' : 'Editar plantillas HTML de email' },
        { id: 'admin-site-settings', name: language === 'pt' ? 'Identidade do Site' : language === 'en' ? 'Site Identity' : 'Identidad del Sitio', icon: Globe, color: 'from-blue-500 to-cyan-600', description: language === 'pt' ? 'Logo, favicon, nome e aparência do site' : language === 'en' ? 'Logo, favicon, site name and appearance' : 'Logo, favicon, nombre del sitio y apariencia' }
      ]
    }
  ];

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {language === 'pt' ? 'Dashboard Administrativa' : language === 'en' ? 'Admin Dashboard' : 'Panel Administrativo'}
            </h1>
            <p className="text-blue-100">
              {language === 'pt' ? 'Gerencie todos os aspectos do sistema' : language === 'en' ? 'Manage all aspects of the system' : 'Gestionar todos los aspectos del sistema'}
            </p>
          </div>
          <div className="hidden sm:block">
            <div className="bg-white bg-opacity-20 p-4 rounded-lg">
              <BarChart3 className="h-10 w-10" />
            </div>
          </div>
        </div>
      </div>

      {adminSections.map((section, sectionIndex) => {
        const visibleItems = section.items.filter(item => isAllowed(item.id));
        if (visibleItems.length === 0) return null;

        return (
          <div key={sectionIndex} className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {section.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      window.history.pushState(null, '', `/${item.id}`);
                    }}
                    className="group bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all duration-200 transform hover:scale-105 relative"
                  >
                    {item.id === 'seller-requests' && pendingRequests > 0 && (
                      <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-lg animate-pulse">
                        {pendingRequests}
                      </div>
                    )}
                    <div className="flex items-start space-x-4">
                      <div className={`bg-gradient-to-br ${item.color} p-3 rounded-lg group-hover:scale-110 transition-transform`}>
                        <IconComponent className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                          {item.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
