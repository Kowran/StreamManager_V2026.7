import React, { useState, useEffect } from 'react';
import { Users, CreditCard, AlertCircle, AlertTriangle, TrendingUp, Package, ShoppingBag, MessageCircle, DollarSign, Star, Newspaper, Store } from 'lucide-react';
import { supabase, ensureUserSetup } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useCurrency } from './CurrencyProvider';
import { useAuth } from './AuthProvider';
import { useActivityTracker } from '../hooks/useActivityTracker';
import { TopRatedProducts } from './TopRatedProducts';
import { BinancePaymentModal } from './BinancePaymentModal';

interface DashboardProps {
  onTabChange?: (tab: string) => void;
  isAdmin?: boolean;
}

interface DashboardStats {
  myPurchases: number;
  activePurchases: number;
  expiredPurchases: number;
  expiringSoon: number;
  myBalance: number;
  myTotalRecharged: number;
  cashbackBalance: number;
}

interface UserProfile {
  full_name?: string;
  email: string;
  role?: string;
}

export function Dashboard({ onTabChange, isAdmin = false }: DashboardProps = {}) {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const { trackAction } = useActivityTracker('dashboard');
  const [stats, setStats] = useState<DashboardStats>({
    myPurchases: 0,
    activePurchases: 0,
    expiredPurchases: 0,
    expiringSoon: 0,
    myBalance: 0,
    myTotalRecharged: 0,
    cashbackBalance: 0
  });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBinanceModal, setShowBinanceModal] = useState(false);
  const [showAmountSelector, setShowAmountSelector] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(10);
  const [isSeller, setIsSeller] = useState(false);

  useEffect(() => {
    loadUserProfile();
    loadDashboardStats();

    // Setup real-time subscription for dashboard updates
    if (user) {
      const channel = supabase
        .channel(`dashboard:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_credits',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            console.log('User credits updated, reloading dashboard stats');
            loadDashboardStats();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_purchases',
            filter: `user_id=eq.${user.id}`
          },
          () => {
            console.log('User purchases updated, reloading dashboard stats');
            loadDashboardStats();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`
          },
          () => {
            console.log('User profile updated, reloading profile data');
            loadUserProfile();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  async function loadUserProfile() {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, role')
        .eq('id', user.id)
        .maybeSingle();

      setUserProfile(profile || { email: user.email || '' });
      setIsSeller(profile?.role === 'seller' || profile?.role === 'admin');

      // If no profile exists, create it in background
      if (!profile) {
        ensureUserSetup(user.id, user.email || '').catch(console.error);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUserProfile({ email: user.email || '' });
    }
  }

  async function loadDashboardStats() {
    if (!user) return;
    
    setLoading(true);
    try {
      // Buscar compras do usuário
      const { data: userPurchases } = await supabase
        .from('user_purchases')
        .select('id, expires_at, expired')
        .eq('user_id', user.id);

      // Calcular estatísticas de expiração
      const now = new Date();
      const activePurchases = userPurchases?.filter(p => 
        !p.expired && (!p.expires_at || new Date(p.expires_at) > now)
      ).length || 0;
      
      const expiredPurchases = userPurchases?.filter(p => 
        p.expired || (p.expires_at && new Date(p.expires_at) <= now)
      ).length || 0;
      
      const expiringSoon = userPurchases?.filter(p => {
        if (!p.expires_at || p.expired) return false;
        const expiryDate = new Date(p.expires_at);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry > 0 && daysUntilExpiry <= 7;
      }).length || 0;
      // Buscar créditos do usuário
      const { data: userCredits } = await supabase
        .from('user_credits')
        .select('balance, total_recharged')
        .eq('user_id', user.id)
        .maybeSingle();

      // Buscar cashback do usuário (SM Credits)
      const { data: smCreditsData } = await supabase
        .from('user_sm_credits')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      setStats({
        myPurchases: userPurchases?.length || 0,
        activePurchases,
        expiredPurchases,
        expiringSoon,
        myBalance: userCredits?.balance || 0,
        myTotalRecharged: userCredits?.total_recharged || 0,
        cashbackBalance: smCreditsData?.balance || 0
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  }

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return t.language === 'pt' ? 'Bom dia' : t.language === 'en' ? 'Good morning' : 'Buenos días';
    if (hour < 18) return t.language === 'pt' ? 'Boa tarde' : t.language === 'en' ? 'Good afternoon' : 'Buenas tardes';
    return t.language === 'pt' ? 'Boa noite' : t.language === 'en' ? 'Good evening' : 'Buenas noches';
  }

  function getUserDisplayName() {
    if (userProfile?.full_name) {
      return userProfile.full_name; // Full name
    }
    return userProfile?.email?.split('@')[0] || (t.language === 'pt' ? 'Usuário' : t.language === 'en' ? 'User' : 'Usuario');
  }

  const statCards = [
    {
      title: t.language === 'pt' ? 'Saldo Atual' : t.language === 'en' ? 'Current Balance' : 'Saldo Actual',
      value: formatPrice(stats.myBalance),
      icon: DollarSign,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      clickable: true,
      onClick: () => setShowAmountSelector(true)
    },
    {
      title: t.language === 'pt' ? 'Cashback Acumulado' : t.language === 'en' ? 'Cashback Earned' : 'Cashback Acumulado',
      value: formatPrice(stats.cashbackBalance),
      icon: Star,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600',
      subtitle: t.language === 'pt' ? '1% de cashback em compras' : t.language === 'en' ? '1% cashback on purchases' : '1% de cashback en compras'
    },
    {
      title: t.language === 'pt' ? 'Compras Ativas' : t.language === 'en' ? 'Active Purchases' : 'Compras Activas',
      value: stats.activePurchases,
      icon: Package,
      color: 'bg-purple-500',
      textColor: 'text-purple-600'
    },
    {
      title: t.language === 'pt' ? 'Expirando em Breve' : t.language === 'en' ? 'Expiring Soon' : 'Expirando Pronto',
      value: stats.expiringSoon,
      icon: AlertTriangle,
      color: 'bg-orange-500',
      textColor: 'text-orange-600'
    },
    {
      title: t.language === 'pt' ? 'Total Recarregado' : t.language === 'en' ? 'Total Recharged' : 'Total Recargado',
      value: formatPrice(stats.myTotalRecharged),
      icon: TrendingUp,
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting Section */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              {getGreeting()}, {getUserDisplayName()}! 👋
            </h1>
            <p className="text-blue-100">
              {t.welcomeBack}
            </p>
          </div>
          <div className="hidden sm:block">
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <Package className="h-8 w-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Cards de estatísticas */}
      {/* Affiliate Program Banner */}
      <div className="bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 rounded-lg p-6 text-white shadow-lg border border-yellow-300 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white bg-opacity-10 rounded-full"></div>
        <div className="absolute bottom-0 left-0 -mb-6 -ml-6 w-32 h-32 bg-white bg-opacity-5 rounded-full"></div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">
                  🎉 {t.language === 'pt' ? 'Convide Amigos e Ganhe!' :
                      t.language === 'en' ? 'Invite Friends and Earn!' :
                      '¡Invita Amigos y Gana!'}
                </h3>
              </div>
              
              <p className="text-yellow-100 mb-4 text-sm leading-relaxed">
                {t.language === 'pt' ? 'Convide amigos e ganhe 5% de comissão vitalícia em todas as recargas deles! Quanto mais amigos você trouxer, mais você ganha.' :
                 t.language === 'en' ? 'Invite friends and earn 5% lifetime commission on all their recharges! The more friends you bring, the more you earn.' :
                 '¡Invita amigos y gana 5% de comisión de por vida en todas sus recargas! Cuantos más amigos traigas, más ganas.'}
              </p>
              
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex items-center space-x-2 bg-white bg-opacity-20 px-3 py-1 rounded-full">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {t.language === 'pt' ? 'Comissão de 5%' :
                     t.language === 'en' ? '5% Commission' :
                     'Comisión del 5%'}
                  </span>
                </div>
                <div className="flex items-center space-x-2 bg-white bg-opacity-20 px-3 py-1 rounded-full">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {t.language === 'pt' ? 'Pagamento Instantâneo' :
                     t.language === 'en' ? 'Instant Payment' :
                     'Pago Instantáneo'}
                  </span>
                </div>
                <div className="flex items-center space-x-2 bg-white bg-opacity-20 px-3 py-1 rounded-full">
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {t.language === 'pt' ? 'Vitalício' :
                     t.language === 'en' ? 'Lifetime' :
                     'De por Vida'}
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => {
                  onTabChange?.('affiliates');
                  window.history.pushState(null, '', '/affiliates');
                }}
                className="inline-flex items-center px-6 py-3 bg-white text-yellow-600 font-bold rounded-lg hover:bg-yellow-50 transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                <Users className="h-5 w-5 mr-2" />
                <span>
                  {t.language === 'pt' ? 'Começar a Indicar' :
                   t.language === 'en' ? 'Start Referring' :
                   'Comenzar a Referir'}
                </span>
              </button>
            </div>
            
            <div className="hidden lg:block ml-6">
              <div className="bg-white bg-opacity-20 p-4 rounded-xl">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">5%</div>
                  <div className="text-sm text-yellow-100">
                    {t.language === 'pt' ? 'de cada recarga' :
                     t.language === 'en' ? 'of each recharge' :
                     'de cada recarga'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {statCards.map((card, index) => {
          const IconComponent = card.icon;
          const CardContent = (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 leading-tight">{card.title}</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
              </div>
              <div className={`${card.color} p-2 sm:p-3 rounded-lg`}>
                <IconComponent className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
              </div>
            </div>
          );

          if (card.clickable && card.onClick) {
            return (
              <button
                key={index}
                onClick={card.onClick}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 border-green-200 dark:border-green-700 p-3 sm:p-4 lg:p-6 transition-all hover:shadow-lg hover:border-green-500 hover:scale-105 cursor-pointer text-left w-full group relative"
              >
                {CardContent}
                <div className="absolute bottom-2 right-2 text-xs text-green-600 dark:text-green-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  {t.language === 'pt' ? '💳 Clique para recarregar' : t.language === 'en' ? '💳 Click to recharge' : '💳 Haz clic para recargar'}
                </div>
              </button>
            );
          }

          return (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 lg:p-6 transition-colors">
              {CardContent}
              {card.subtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{card.subtitle}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Seção de resumo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 lg:p-6 transition-colors">
          <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            {t.language === 'pt' ? 'Resumo da Conta' : t.language === 'en' ? 'Account Summary' : 'Resumen de Cuenta'}
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t.language === 'pt' ? 'Saldo Atual' : t.language === 'en' ? 'Current Balance' : 'Saldo Actual'}
              </span>
              <span className="text-sm font-semibold text-green-600">{formatPrice(stats.myBalance)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t.language === 'pt' ? 'Total de Compras' : t.language === 'en' ? 'Total Purchases' : 'Total de Compras'}
              </span>
              <span className="text-sm font-semibold text-purple-600">{stats.myPurchases}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t.language === 'pt' ? 'Compras Ativas' : t.language === 'en' ? 'Active Purchases' : 'Compras Activas'}
              </span>
              <span className="text-sm font-semibold text-green-600">{stats.activePurchases}</span>
            </div>
            {stats.expiringSoon > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t.language === 'pt' ? 'Expirando em Breve' : t.language === 'en' ? 'Expiring Soon' : 'Expirando Pronto'}
                </span>
                <span className="text-sm font-semibold text-yellow-600">{stats.expiringSoon}</span>
              </div>
            )}
            {stats.expiredPurchases > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t.language === 'pt' ? 'Compras Expiradas' : t.language === 'en' ? 'Expired Purchases' : 'Compras Expiradas'}
                </span>
                <span className="text-sm font-semibold text-red-600">{stats.expiredPurchases}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t.language === 'pt' ? 'Total Recarregado' : t.language === 'en' ? 'Total Recharged' : 'Total Recargado'}
              </span>
              <span className="text-sm font-semibold text-blue-600">{formatPrice(stats.myTotalRecharged)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 lg:p-6 transition-colors">
          <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
            {t.language === 'pt' ? 'Atividade Recente' : t.language === 'en' ? 'Recent Activity' : 'Actividad Reciente'}
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t.language === 'pt' ? 'Última Compra' : t.language === 'en' ? 'Last Purchase' : 'Última Compra'}
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.myPurchases > 0 ? 
                  (t.language === 'pt' ? 'Recente' : t.language === 'en' ? 'Recent' : 'Reciente') : 
                  (t.language === 'pt' ? 'Nenhuma' : t.language === 'en' ? 'None' : 'Ninguna')
                }
              </span>
            </div>
            {stats.expiringSoon > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t.language === 'pt' ? 'Produtos Expirando' : t.language === 'en' ? 'Products Expiring' : 'Productos Expirando'}
                </span>
                <span className="text-sm font-semibold text-yellow-600">
                  {stats.expiringSoon} {t.language === 'pt' ? 'em 7 dias' : t.language === 'en' ? 'in 7 days' : 'en 7 días'}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t.language === 'pt' ? 'Gasto Total' : t.language === 'en' ? 'Total Spent' : 'Total Gastado'}
              </span>
              <span className="text-sm font-semibold text-orange-600">
                {formatPrice(stats.myTotalRecharged - stats.myBalance)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Rated Products Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 lg:p-6 transition-colors">
        <TopRatedProducts limit={3} showTitle={true} />
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 lg:p-6 transition-colors">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">{t.quickActions}</h3>
        <div className={`grid grid-cols-2 sm:grid-cols-2 ${isSeller ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-2 sm:gap-3 lg:gap-4`}>
          <button
            onClick={() => {
              onTabChange?.('community');
              window.history.pushState(null, '', '/community');
            }}
            className="text-center p-3 sm:p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-colors cursor-pointer group touch-manipulation"
          >
            <Newspaper className="h-6 w-6 sm:h-8 sm:w-8 text-cyan-600 dark:text-cyan-400 mx-auto mb-1 sm:mb-2" />
            <h4 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white leading-tight">
              {t.language === 'pt' ? 'Comunidade' : t.language === 'en' ? 'Community' : 'Comunidad'}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {t.language === 'pt' ? 'Veja novidades e atualizações' : t.language === 'en' ? 'See news and updates' : 'Ver novedades y actualizaciones'}
            </p>
          </button>
          <button
            onClick={() => {
              onTabChange?.('store');
              window.history.pushState(null, '', '/store');
            }}
            className="text-center p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer group touch-manipulation"
          >
            <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 dark:text-blue-400 mx-auto mb-1 sm:mb-2" />
            <h4 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white leading-tight">{t.buyInStore}</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {t.language === 'pt' ? 'Compre produtos premium' : t.language === 'en' ? 'Buy premium products' : 'Compra productos premium'}
            </p>
          </button>
          <button
            onClick={() => {
              onTabChange?.('credits');
              window.history.pushState(null, '', '/credits');
            }}
            className="text-center p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors cursor-pointer group touch-manipulation"
          >
            <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 dark:text-green-400 mx-auto mb-1 sm:mb-2" />
            <h4 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white leading-tight">
              {t.language === 'pt' ? 'Recarregar' : t.language === 'en' ? 'Recharge Credits' : 'Recargar Créditos'}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {t.language === 'pt' ? 'Adicione créditos à sua conta' :
               t.language === 'en' ? 'Add credits to your account' :
               'Agrega créditos a tu cuenta'}
            </p>
          </button>
          <button
            onClick={() => {
              onTabChange?.('accounts');
              window.history.pushState(null, '', '/accounts');
            }}
            className="text-center p-3 sm:p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors cursor-pointer group touch-manipulation"
          >
            <Package className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 dark:text-purple-400 mx-auto mb-1 sm:mb-2" />
            <h4 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white leading-tight">
              {t.language === 'pt' ? 'Gerenciador Streaming' : t.language === 'en' ? 'Streaming Manager' : 'Gestor Streaming'}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {t.language === 'pt' ? 'Gerencie suas contas de streaming' : t.language === 'en' ? 'Manage your streaming accounts' : 'Gestiona tus cuentas de streaming'}
            </p>
          </button>
          <button
            onClick={() => {
              onTabChange?.('support');
              window.history.pushState(null, '', '/support');
            }}
            className="text-center p-3 sm:p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer group touch-manipulation"
          >
            <MessageCircle className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-600 dark:text-indigo-400 mx-auto mb-1 sm:mb-2" />
            <h4 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white leading-tight">
              {t.language === 'pt' ? 'Suporte' : t.language === 'en' ? 'Support' : 'Soporte'}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {t.language === 'pt' ? 'Obtenha ajuda e suporte' :
               t.language === 'en' ? 'Get help and support' :
               'Obtén ayuda y soporte'}
            </p>
          </button>
          {isSeller && (
            <button
              onClick={() => {
                onTabChange?.('seller-store');
                window.history.pushState(null, '', '/seller-store');
              }}
              className="text-center p-3 sm:p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors cursor-pointer group touch-manipulation"
            >
              <Store className="h-6 w-6 sm:h-8 sm:w-8 text-amber-600 dark:text-amber-400 mx-auto mb-1 sm:mb-2" />
              <h4 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white leading-tight">
                {t.language === 'pt' ? 'Minha Loja' : t.language === 'en' ? 'My Store' : 'Mi Tienda'}
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {t.language === 'pt' ? 'Gerencie seus produtos' :
                 t.language === 'en' ? 'Manage your products' :
                 'Gestiona tus productos'}
              </p>
            </button>
          )}
        </div>
      </div>

      {/* Amount Selector Modal */}
      {showAmountSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {t.language === 'pt' ? 'Quanto deseja recarregar?' : t.language === 'en' ? 'How much would you like to recharge?' : '¿Cuánto desea recargar?'}
            </h3>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[10, 20, 50, 100, 200, 500].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setRechargeAmount(amount)}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${
                    rechargeAmount === amount
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="text-xl font-bold">${amount}</div>
                </button>
              ))}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t.language === 'pt' ? 'Ou digite um valor personalizado:' : t.language === 'en' ? 'Or enter a custom amount:' : 'O ingrese un monto personalizado:'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max="10000"
                  value={rechargeAmount}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (value && value >= 1) {
                      setRechargeAmount(value);
                    }
                  }}
                  className="pl-10 pr-4 py-3 w-full border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="1.00"
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowAmountSelector(false);
                  setRechargeAmount(10);
                }}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t.language === 'pt' ? 'Cancelar' : t.language === 'en' ? 'Cancel' : 'Cancelar'}
              </button>
              <button
                onClick={() => {
                  setShowAmountSelector(false);
                  setShowBinanceModal(true);
                }}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                {t.language === 'pt' ? 'Continuar' : t.language === 'en' ? 'Continue' : 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Binance Payment Modal */}
      <BinancePaymentModal
        isOpen={showBinanceModal}
        onClose={() => setShowBinanceModal(false)}
        amount={rechargeAmount}
        onSuccess={() => {
          setShowBinanceModal(false);
          loadDashboardStats();
        }}
      />
    </div>
  );
}