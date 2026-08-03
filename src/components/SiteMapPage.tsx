import { useState } from 'react';
import {
  ShoppingCart, Package, Store as StoreIcon, Gamepad2, CreditCard, UserCheck,
  TrendingUp, Wallet, MessageCircle, DollarSign, BookOpen, Users, Clapperboard,
  Shield, Mail, Briefcase, HelpCircle, Map, ArrowLeft, ChevronDown, ChevronRight,
  Zap, Bell, User, Headphones, FileText, Globe, Sparkles, type LucideIcon
} from 'lucide-react';
import { useLanguage } from './LanguageProvider';

interface SiteMapPageProps {
  onBack: () => void;
}

interface MapLink {
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
}

interface MapSection {
  title: string;
  icon: LucideIcon;
  color: string;
  links: MapLink[];
}

export function SiteMapPage({ onBack }: SiteMapPageProps) {
  const { t } = useLanguage();
  const lang = t.language;
  const tr = (pt: string, en: string, es: string) => (lang === 'pt' ? pt : lang === 'en' ? en : es);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const navigate = (path: string) => {
    if (path === '/') {
      window.history.pushState(null, '', '/');
    } else {
      window.history.pushState(null, '', path);
    }
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sections: MapSection[] = [
    {
      title: tr('Compras', 'Shopping', 'Compras'),
      icon: ShoppingCart,
      color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
      links: [
        { label: tr('Loja Principal', 'Main Store', 'Tienda Principal'), description: tr('Navegue por todos os produtos digitais disponíveis', 'Browse all available digital products', 'Explora todos los productos digitales disponibles'), path: '/', icon: StoreIcon },
        { label: tr('Categorias de Jogos', 'Game Categories', 'Categorías de Juegos'), description: tr('Explore produtos organizados por jogo', 'Browse products organized by game', 'Explora productos organizados por juego'), path: '/game-categories', icon: Gamepad2 },
        { label: tr('Minhas Compras', 'My Purchases', 'Mis Compras'), description: tr('Veja seu histórico de compras e credenciais', 'View your purchase history and credentials', 'Ver tu historial de compras y credenciales'), path: '/purchases', icon: Package },
        { label: tr('Carrinho', 'Cart', 'Carrito'), description: tr('Revise os itens antes de finalizar a compra', 'Review items before checkout', 'Revisa los artículos antes de finalizar'), path: '/cart', icon: ShoppingCart },
        { label: tr('Checkout', 'Checkout', 'Checkout'), description: tr('Finalize seu pagamento com segurança', 'Complete your payment securely', 'Completa tu pago de forma segura'), path: '/checkout', icon: CreditCard },
      ],
    },
    {
      title: tr('Vender', 'Selling', 'Vender'),
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30',
      links: [
        { label: tr('Seja um Vendedor', 'Become a Seller', 'Ser Vendedor'), description: tr('Candidate-se para vender na plataforma', 'Apply to sell on the platform', 'Postúlate para vender en la plataforma'), path: '/seller-recruitment', icon: UserCheck },
        { label: tr('Minha Loja', 'My Store', 'Mi Tienda'), description: tr('Gerencie seus produtos e vendas', 'Manage your products and sales', 'Gestiona tus productos y ventas'), path: '/seller-store', icon: StoreIcon },
        { label: tr('Painel SMM', 'SMM Panel', 'Panel SMM'), description: tr('Serviços de marketing de mídia social', 'Social media marketing services', 'Servicios de marketing en redes sociales'), path: '/smm', icon: TrendingUp },
      ],
    },
    {
      title: tr('Conta', 'Account', 'Cuenta'),
      icon: User,
      color: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30',
      links: [
        { label: tr('Meu Perfil', 'My Profile', 'Mi Perfil'), description: tr('Edite suas informações pessoais', 'Edit your personal information', 'Edita tu información personal'), path: '/profile', icon: User },
        { label: tr('Meus Créditos', 'My Credits', 'Mis Créditos'), description: tr('Saldo e histórico de créditos', 'Balance and credit history', 'Saldo e historial de créditos'), path: '/credits', icon: Wallet },
        { label: tr('Notificações', 'Notifications', 'Notificaciones'), description: tr('Central de notificações e alertas', 'Notification center and alerts', 'Centro de notificaciones y alertas'), path: '/notifications', icon: Bell },
        { label: tr('Mensagens', 'Messages', 'Mensajes'), description: tr('Chat e conversas com vendedores', 'Chat and conversations with sellers', 'Chat y conversaciones con vendedores'), path: '/messages', icon: MessageCircle },
      ],
    },
    {
      title: tr('Comunidade', 'Community', 'Comunidad'),
      icon: Users,
      color: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30',
      links: [
        { label: tr('Blog', 'Blog', 'Blog'), description: tr('Notícias, artigos e atualizações', 'News, articles and updates', 'Noticias, artículos y novedades'), path: '/blog', icon: BookOpen },
        { label: tr('Afiliados', 'Affiliates', 'Afiliados'), description: tr('Ganhe comissões indicando produtos', 'Earn commissions by referring products', 'Gana comisiones refiriendo productos'), path: '/affiliates', icon: Users },
        { label: tr('Streaming', 'Streaming', 'Streaming'), description: tr('Contas e serviços de streaming', 'Streaming accounts and services', 'Cuentas y servicios de streaming'), path: '/accounts', icon: Clapperboard },
      ],
    },
    {
      title: tr('Suporte & Ajuda', 'Support & Help', 'Soporte y Ayuda'),
      icon: Headphones,
      color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900/30',
      links: [
        { label: tr('Central de Ajuda', 'Help Center', 'Centro de Ayuda'), description: tr('Tire dúvidas e encontre soluções', 'Get help and find solutions', 'Resuelve dudas y encuentra soluciones'), path: '/support', icon: HelpCircle },
        { label: tr('Taxas e Prazos', 'Fees & Deadlines', 'Comisiones y Plazos'), description: tr('Informações sobre taxas e prazos de saque', 'Information about fees and withdrawal deadlines', 'Información sobre comisiones y plazos de retiro'), path: '/fees-page', icon: DollarSign },
      ],
    },
    {
      title: tr('Institucional', 'Institutional', 'Institucional'),
      icon: FileText,
      color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50',
      links: [
        { label: tr('Trabalhe Conosco', 'Work With Us', 'Trabaja con Nosotros'), description: tr('Oportunidades de trabalho e parcerias', 'Job opportunities and partnerships', 'Oportunidades de trabajo y alianzas'), path: '/work-with-us', icon: Briefcase },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-12">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{tr('Voltar', 'Back', 'Volver')}</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-8">
        {/* Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl mb-4 shadow-lg">
            <Map className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {tr('Mapa do Site', 'Site Map', 'Mapa del Sitio')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            {tr('Navegue por todas as áreas da plataforma. Clique em qualquer item para acessar a página.', 'Navigate all areas of the platform. Click any item to visit the page.', 'Navega por todas las áreas de la plataforma. Haz clic en cualquier elemento para acceder.')}
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map((section, si) => {
            const SectionIcon = section.icon;
            const isExpanded = openSection === null || openSection === `s${si}`;
            return (
              <div key={si} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => setOpenSection(isExpanded && openSection !== null ? null : `s${si}`)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${section.color}`}>
                    <SectionIcon className="h-4.5 w-4.5" />
                  </div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white flex-1 text-left">{section.title}</h2>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-5 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {section.links.map((link, li) => {
                        const LinkIcon = link.icon;
                        return (
                          <button
                            key={li}
                            onClick={() => navigate(link.path)}
                            className="flex items-start gap-3 p-3 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors group border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                          >
                            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                              <LinkIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">{link.label}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{link.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick contact card */}
        <div className="mt-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl border border-blue-200 dark:border-gray-700 p-5 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl mb-3">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
            {tr('Não encontrou o que procura?', 'Didn\'t find what you\'re looking for?', '¿No encontraste lo que buscas?')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {tr('Entre em contato com nosso suporte', 'Contact our support team', 'Contacta a nuestro equipo de soporte')}
          </p>
          <button
            onClick={() => navigate('/support')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md"
          >
            <Headphones className="h-4 w-4" />
            <span>{tr('Falar com Suporte', 'Contact Support', 'Hablar con Soporte')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
