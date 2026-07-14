import React, { useState, useEffect } from 'react';
import { CreditCard, Play, Settings, Menu, X, User, ShoppingBag, Mail, Shield, Moon, Sun, TrendingUp, Newspaper, Users, HelpCircle, LogIn } from 'lucide-react';
import { useCommunityUnreadCount } from './hooks/useCommunityUnreadCount';
import { supabase } from './lib/supabase';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { LanguageProvider, useLanguage } from './components/LanguageProvider';
import { ThemeProvider, useTheme } from './components/ThemeProvider';
import { LanguageSelector } from './components/LanguageSelector';
import { LoginModal } from './components/LoginModal';
import { CurrencySelector } from './components/CurrencySelector';
import { CurrencyProvider } from './components/CurrencyProvider';
import { UserMenu } from './components/UserMenu';
import { NotificationCenter } from './components/NotificationCenter';
import { NotificationProvider } from './components/NotificationProvider';
import { LoginForm } from './components/LoginForm';
import { AccountsManager } from './components/AccountsManager';
import { ClientsManager } from './components/ClientsManager';
import { SellersManager } from './components/SellersManager';
import { ServicesManager } from './components/ServicesManager';
import { Store } from './components/Store';
import { ProductDetailPage } from './components/ProductDetailPage';
import { AdminProductsManager } from './components/AdminProductsManager';
import { UserPurchases } from './components/UserPurchases';
import { Package } from 'lucide-react';
import { AccountsAccessGuard } from './components/AccountsAccessGuard';
import AdminUsersManager from './components/AdminUsersManager';
import AdminSettingsManager from './components/AdminSettingsManager';
import AdminSiteSettingsManager from './components/AdminSiteSettingsManager';
import { LandingPage } from './components/LandingPage';
import { AccountsAccessManager } from './components/AccountsAccessManager';
import { MessageCircle } from 'lucide-react';
import { SupportSystem } from './components/SupportSystem';
import { AdminSupportManager } from './components/AdminSupportManager';
import { UserProfile } from './components/UserProfile';
import { CreditsManager } from './components/CreditsManager';
import { DollarSign } from 'lucide-react';
import AdminPaymentManager from './components/AdminPaymentManager';
import { AdminCreditManager } from './components/AdminCreditManager';
import { AffiliateSystem } from './components/AffiliateSystem';
import { AdminSalesManager } from './components/AdminSalesManager';
import { AdminWithdrawalManager } from './components/AdminWithdrawalManager';
import { AdminEmailVerifier } from './components/AdminEmailVerifier';
import { NetflixEmailFinder } from './components/NetflixEmailFinder';
import { Footer } from './components/Footer';
import { AdminDashboard } from './components/AdminDashboard';
import { SMMPanel } from './components/SMMPanel';
import { AdminSMMManager } from './components/AdminSMMManager';
import { AdminSMMProviders } from './components/AdminSMMProviders';
import { AdminSMMOrders } from './components/AdminSMMOrders';
import Community from './components/Community';
import AdminCommunityManager from './components/AdminCommunityManager';
import { AdminSellerRequests } from './components/AdminSellerRequests';
import { ExpiringItemsChat } from './components/ExpiringItemsChat';
import { FlyingBalloon } from './components/FlyingBalloon';
import { AdminNetflixAccounts } from './components/AdminNetflixAccounts';
import { AdminNotificationsManager } from './components/AdminNotificationsManager';
import AdminPopupManager from './components/AdminPopupManager';
import AdminFlyingBalloonManager from './components/AdminFlyingBalloonManager';
import { NotificationsPage } from './components/NotificationsPage';
import { SellerStore } from './components/SellerStore';
import { PublicSellerProfilePage } from './components/PublicSellerProfilePage';
import { AdminGuard } from './components/AdminGuard';
import { PopupDisplay } from './components/PopupDisplay';
import { AnnouncementBar } from './components/AnnouncementBar';
import { AdminAnnouncementManager } from './components/AdminAnnouncementManager';
import { AdminBannerManager } from './components/AdminBannerManager';
import { AdminCouponsManager } from './components/AdminCouponsManager';
import { NicknameSetupModal } from './components/NicknameSetupModal';
import { ChatInbox } from './components/ChatInbox';
import { useOnlineHeartbeat } from './hooks/useOnlineStatus';

type ActiveTab = 'store' | 'accounts' | 'clients' | 'sellers' | 'services' | 'admin-products' | 'purchases' | 'admin-users' | 'admin-settings' | 'admin-site-settings' | 'accounts-access' | 'support' | 'admin-support' | 'profile' | 'credits' | 'admin-payments' | 'admin-credits' | 'affiliates' | 'admin-sales' | 'admin-withdrawals' | 'admin-coupons' | 'email-verifier' | 'netflix-finder' | 'admin-dashboard' | 'smm' | 'admin-smm' | 'admin-smm-providers' | 'admin-smm-orders' | 'community' | 'admin-community' | 'seller-requests' | 'admin-netflix-accounts' | 'admin-notifications' | 'admin-popups' | 'admin-announcements' | 'admin-banners' | 'admin-flying-balloons' | 'notifications' | 'seller-store' | 'seller-profile' | 'messages' | 'product-detail';

interface StoreConfig {
  store_name?: string;
  store_logo_url?: string;
}

function AppContent() {
  const { user, loading, isPasswordRecovery } = useAuth();
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('store');
  const [productDetailId, setProductDetailId] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [subdomain, setSubdomain] = useState<'main' | 'login' | 'home'>('main');
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
  const [siteSettings, setSiteSettings] = useState<{ site_name?: string; header_logo_url?: string; browser_title?: string; favicon_url?: string } | null>(null);
  const [sellerSlug, setSellerSlug] = useState<string | null>(null);
  const communityUnreadCount = useCommunityUnreadCount(user?.id);

  useOnlineHeartbeat(user?.id);

  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  // Dynamic browser title & favicon from site settings
  useEffect(() => {
    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    const defaultHref = link.href;

    (async () => {
      try {
        const { data } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'site_settings')
          .maybeSingle();
        const s = data?.value;
        if (s?.browser_title) document.title = s.browser_title;
        else if (s?.site_name) document.title = s.site_name;
        if (s?.favicon_url) link!.href = s.favicon_url;
      } catch { /* ignore */ }
    })();

    return () => { link!.href = defaultHref; };
  }, []);

  useEffect(() => {
    if (!user) return;
    loadChatUnread();
    const ch = supabase
      .channel('chat-unread-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_chats' }, loadChatUnread)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  async function loadChatUnread() {
    if (!user) return;
    const { data } = await supabase
      .from('direct_chats')
      .select('user1_id, user1_unread, user2_unread')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
    const total = (data || []).reduce((acc, c) => {
      return acc + (c.user1_id === user.id ? c.user1_unread : c.user2_unread);
    }, 0);
    setChatUnreadCount(total);
  }

  useEffect(() => {
    detectSubdomain();
    loadStoreConfig();
  }, []);

  function detectSubdomain() {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');

    if (parts.length > 2 || hostname.includes('localhost')) {
      const sub = parts[0];
      if (sub === 'login' || sub === 'painel' || sub === 'panel' || sub === 'dashboard') {
        if (sub === 'dashboard') { window.location.hash = '#store'; return; }
        setSubdomain('login');
        setShowLanding(false);
      } else if (sub === 'home' || sub === 'www' || hostname.includes('localhost')) {
        setSubdomain('home');
        setShowLanding(true);
      }
    }
  }

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setIsSeller(false);
      setNeedsUsername(false);
      return;
    }
    checkAdminStatus();

    if (user) {
      const channel = supabase
        .channel(`profile-changes:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`
          },
          (payload) => {
            console.log('Profile updated:', payload);
            checkAdminStatus();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  // Handle URL hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) || 'store';

      // Check if it's a seller profile route
      if (hash.startsWith('seller/')) {
        const slug = hash.replace('seller/', '');
        setSellerSlug(slug);
        setActiveTab('seller-profile');
      } else if (hash.startsWith('product/')) {
        const productId = hash.replace('product/', '');
        setProductDetailId(productId);
        setActiveTab('product-detail');
      } else if (hash && hash !== activeTab) {
        setSellerSlug(null);
        setProductDetailId(null);
        setActiveTab(hash as ActiveTab);
      }
    };

    // Set initial tab from URL
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update URL when tab changes (skip product-detail, which uses #product/<id>)
  useEffect(() => {
    if (user && !loading && activeTab !== 'product-detail') {
      const currentHash = window.location.hash.slice(1);
      if (currentHash !== activeTab) {
        window.history.pushState(null, '', `#${activeTab}`);
      }
    }
  }, [activeTab, user, loading]);

  async function loadStoreConfig() {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'store_config')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setStoreConfig(data?.value || null);

      const { data: siteData } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'site_settings')
        .maybeSingle();
      setSiteSettings(siteData?.value || null);
    } catch (error) {
      console.error('Error loading store config:', error);
    }
  }

  async function checkAdminStatus() {
    if (!user) return;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, username')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
        setIsSeller(false);
        setNeedsUsername(false);
        return;
      }

      console.log('User profile role:', profile?.role);
      const isAdminUser = profile?.role === 'admin';
      const isSellerUser = profile?.role === 'seller' || profile?.role === 'admin';

      console.log('Setting isAdmin:', isAdminUser, 'isSeller:', isSellerUser);
      setIsAdmin(isAdminUser);
      setIsSeller(isSellerUser);
      setNeedsUsername(!profile?.username);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
      setIsSeller(false);
      setNeedsUsername(false);
    }
  }

  const headerNavigation = [
    { id: 'community', name: t.language === 'pt' ? 'Comunidade' : t.language === 'en' ? 'Community' : 'Comunidad', icon: Newspaper },
    { id: 'affiliates', name: t.language === 'pt' ? 'Afiliados' : t.language === 'en' ? 'Affiliates' : 'Afiliados', icon: Users },
    { id: 'accounts', name: t.language === 'pt' ? 'Streaming' : t.language === 'en' ? 'Streaming' : 'Streaming', icon: Play },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'admin-dashboard':
        return (
          <AdminGuard>
            <AdminDashboard onNavigate={setActiveTab} />
          </AdminGuard>
        );
      case 'accounts':
        return (
          <AccountsAccessGuard>
            <AccountsManager />
          </AccountsAccessGuard>
        );
      case 'sellers':
        return (
          <AdminGuard page="sellers">
            <SellersManager />
          </AdminGuard>
        );
      case 'services':
        return (
          <AdminGuard page="services">
            <ServicesManager />
          </AdminGuard>
        );
      case 'store':
        return <Store onNavigate={setActiveTab} />;
      case 'smm':
        return <SMMPanel onNavigate={(tab) => setActiveTab(tab as ActiveTab)} />;
      case 'admin-smm-providers':
        return (
          <AdminGuard page="admin-smm-providers">
            <AdminSMMProviders />
          </AdminGuard>
        );
      case 'admin-smm':
        return (
          <AdminGuard page="admin-smm">
            <AdminSMMManager />
          </AdminGuard>
        );
      case 'admin-smm-orders':
        return (
          <AdminGuard page="admin-smm-orders">
            <AdminSMMOrders />
          </AdminGuard>
        );
      case 'admin-products':
        return (
          <AdminGuard page="admin-products">
            <AdminProductsManager />
          </AdminGuard>
        );
      case 'credits':
        return <CreditsManager />;
      case 'purchases':
        return <UserPurchases />;
      case 'admin-users':
        return (
          <AdminGuard page="admin-users">
            <AdminUsersManager />
          </AdminGuard>
        );
      case 'admin-settings':
        return (
          <AdminGuard page="admin-settings">
            <AdminSettingsManager />
          </AdminGuard>
        );
      case 'admin-site-settings':
        return (
          <AdminGuard page="admin-site-settings">
            <AdminSiteSettingsManager />
          </AdminGuard>
        );
      case 'accounts-access':
        return (
          <AdminGuard page="accounts-access">
            <AccountsAccessManager />
          </AdminGuard>
        );
      case 'support':
        return <SupportSystem />;
      case 'admin-support':
        return (
          <AdminGuard page="admin-support">
            <AdminSupportManager />
          </AdminGuard>
        );
      case 'profile':
        return <UserProfile onNavigate={setActiveTab} />;
      case 'admin-payments':
        return (
          <AdminGuard page="admin-payments">
            <AdminPaymentManager />
          </AdminGuard>
        );
      case 'admin-credits':
        return (
          <AdminGuard page="admin-credits">
            <AdminCreditManager />
          </AdminGuard>
        );
      case 'affiliates':
        return <AffiliateSystem />;
      case 'admin-sales':
        return (
          <AdminGuard page="admin-sales">
            <AdminSalesManager />
          </AdminGuard>
        );
      case 'admin-withdrawals':
        return (
          <AdminGuard page="admin-withdrawals">
            <AdminWithdrawalManager />
          </AdminGuard>
        );
      case 'admin-coupons':
        return (
          <AdminGuard page="admin-coupons">
            <AdminCouponsManager />
          </AdminGuard>
        );
      case 'community':
        return <Community />;
      case 'admin-community':
        return (
          <AdminGuard page="admin-community">
            <AdminCommunityManager />
          </AdminGuard>
        );
      case 'admin-notifications':
        return (
          <AdminGuard page="admin-notifications">
            <AdminNotificationsManager />
          </AdminGuard>
        );
      case 'admin-popups':
        return (
          <AdminGuard page="admin-popups">
            <AdminPopupManager />
          </AdminGuard>
        );
      case 'admin-announcements':
        return (
          <AdminGuard page="admin-announcements">
            <AdminAnnouncementManager />
          </AdminGuard>
        );
      case 'admin-banners':
        return (
          <AdminGuard page="admin-banners">
            <AdminBannerManager />
          </AdminGuard>
        );
      case 'admin-flying-balloons':
        return (
          <AdminGuard page="admin-flying-balloons">
            <AdminFlyingBalloonManager />
          </AdminGuard>
        );
      case 'messages':
        return <ChatInbox />;
      case 'notifications':
        return <NotificationsPage />;
      case 'seller-requests':
        return (
          <AdminGuard page="seller-requests">
            <AdminSellerRequests />
          </AdminGuard>
        );
      case 'admin-netflix-accounts':
        return (
          <AdminGuard page="admin-netflix-accounts">
            <AdminNetflixAccounts />
          </AdminGuard>
        );
      case 'seller-store':
        return <SellerStore />;
      case 'seller-profile':
        if (!sellerSlug) return <Store onNavigate={setActiveTab} />;
        return (
          <PublicSellerProfilePage
            sellerSlug={sellerSlug}
            onBack={() => {
              setActiveTab('store');
              setSellerSlug(null);
              window.history.pushState(null, '', '#store');
            }}
            onProductClick={(product: any) => {
              console.log('Product clicked:', product);
            }}
          />
        );
      case 'email-verifier':
        // Redirect to external URL
        window.open('https://streammanager.online/', '_blank');
        return <Store onNavigate={setActiveTab} />;
      case 'netflix-finder':
        return (
          <AdminGuard>
            <NetflixEmailFinder />
          </AdminGuard>
        );
      default:
        return <Store onNavigate={setActiveTab} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900">
        <AnnouncementBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  // Show password reset form if in recovery mode
  if (isPasswordRecovery) {
    return (
      <div className="min-h-screen flex flex-col">
        <AnnouncementBar />
        <LoginForm />
      </div>
    );
  }

  if (!user) {
    if (activeTab === 'product-detail' && productDetailId) {
      return (
        <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors overflow-x-hidden">
          <AnnouncementBar />
          <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors sticky top-0 z-30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-3 sm:py-4 lg:py-6">
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      setActiveTab('store');
                      setProductDetailId(null);
                      window.history.pushState(null, '', '#store');
                    }}
                    className="sm:hidden flex items-center hover:opacity-80 transition-opacity"
                  >
                    {siteSettings?.header_logo_url || storeConfig?.store_logo_url ? (
                      <img src={siteSettings?.header_logo_url || storeConfig?.store_logo_url} alt="Logo" className="h-6 w-6 object-cover rounded-lg mr-2"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-1.5 rounded-lg mr-2">
                        <CreditCard className="h-3 w-3 text-white" />
                      </div>
                    )}
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {siteSettings?.site_name || storeConfig?.store_name || 'StreamManager'}
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('store');
                      setProductDetailId(null);
                      window.history.pushState(null, '', '#store');
                    }}
                    className="hidden sm:flex items-center hover:opacity-80 transition-opacity"
                  >
                    {siteSettings?.header_logo_url || storeConfig?.store_logo_url ? (
                      <img src={siteSettings?.header_logo_url || storeConfig?.store_logo_url} alt="Logo" className="h-8 w-8 object-cover rounded-lg"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : null}
                    <div className={`bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg ${siteSettings?.header_logo_url || storeConfig?.store_logo_url ? 'hidden' : ''}`}>
                      <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
                    </div>
                    <span className="ml-3 text-xl font-bold text-gray-900 dark:text-white">
                      {siteSettings?.site_name || storeConfig?.store_name || 'StreamManager'}
                    </span>
                  </button>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4">
                  <button onClick={toggleTheme}
                    className="hidden lg:block p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors">
                    {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  </button>
                  <div className="hidden lg:block"><CurrencySelector /></div>
                  <div className="hidden lg:block"><LanguageSelector /></div>
                  <button onClick={() => setShowLoginModal(true)}
                    className="inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
                    <LogIn className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">{t.language === 'pt' ? 'Entrar' : t.language === 'en' ? 'Sign In' : 'Iniciar Sesion'}</span>
                  </button>
                </div>
              </div>
            </div>
          </header>
          <ProductDetailPage
            productId={productDetailId}
            onBack={() => {
              setActiveTab('store');
              setProductDetailId(null);
              window.history.pushState(null, '', '#store');
            }}
            onGetStarted={() => {
              if (subdomain === 'home') {
                const currentUrl = new URL(window.location.href);
                const hostname = currentUrl.hostname;
                const parts = hostname.split('.');
                if (parts.length > 2 || hostname.includes('localhost')) {
                  const mainDomain = parts.slice(-2).join('.');
                  const loginUrl = hostname.includes('localhost')
                    ? `${currentUrl.protocol}//localhost:${currentUrl.port}/#login`
                    : `${currentUrl.protocol}//login.${mainDomain}`;
                  window.location.href = loginUrl;
                } else {
                  setShowLanding(false);
                }
              } else {
                setShowLanding(false);
              }
            }}
            onNavigate={setActiveTab}
          />
          {showLoginModal && (
            <LoginModal
              isOpen={showLoginModal}
              onClose={() => setShowLoginModal(false)}
              onLoginSuccess={() => setShowLoginModal(false)}
            />
          )}
        </div>
      );
    }
    // Product detail page takes priority over landing page for logged-in users
    if (activeTab === 'product-detail' && productDetailId) {
      return (
        <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors overflow-x-hidden">
          <AnnouncementBar />
          <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors sticky top-0 z-30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-3 sm:py-4 lg:py-6">
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      setActiveTab('store');
                      setProductDetailId(null);
                      window.history.pushState(null, '', '#store');
                    }}
                    className="flex items-center hover:opacity-80 transition-opacity"
                  >
                    {siteSettings?.header_logo_url || storeConfig?.store_logo_url ? (
                      <img src={siteSettings?.header_logo_url || storeConfig?.store_logo_url} alt="Logo" className="h-8 w-8 object-cover rounded-lg"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : null}
                    <div className={`bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg ${siteSettings?.header_logo_url || storeConfig?.store_logo_url ? 'hidden' : ''}`}>
                      <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
                    </div>
                    <span className="ml-3 text-xl font-bold text-gray-900 dark:text-white">
                      {siteSettings?.site_name || storeConfig?.store_name || 'StreamManager'}
                    </span>
                  </button>
                </div>
                <div className="flex items-center space-x-2 sm:space-x-3 lg:space-x-4">
                  <button onClick={toggleTheme}
                    className="hidden lg:block p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors">
                    {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  </button>
                  <div className="hidden lg:block"><CurrencySelector /></div>
                  <div className="hidden lg:block"><LanguageSelector /></div>
                  <button onClick={() => { setShowLanding(false); setActiveTab('store'); window.history.pushState(null, '', '#store'); }}
                    className="inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
                    <LogIn className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">{t.language === 'pt' ? 'Ir para Loja' : t.language === 'en' ? 'Go to Store' : 'Ir a la Tienda'}</span>
                  </button>
                </div>
              </div>
            </div>
          </header>
          <ProductDetailPage
            productId={productDetailId}
            onBack={() => {
              setActiveTab('store');
              setProductDetailId(null);
              window.history.pushState(null, '', '#store');
            }}
            onGetStarted={() => {
              setShowLanding(false);
            }}
            onNavigate={setActiveTab}
          />
        </div>
      );
    }
    if (subdomain === 'home' || (subdomain === 'main' && showLanding)) {
      return (
        <div className="min-h-screen flex flex-col">
          <AnnouncementBar />
          <LandingPage onGetStarted={() => {
        if (subdomain === 'home') {
          const currentUrl = new URL(window.location.href);
          const hostname = currentUrl.hostname;
          const parts = hostname.split('.');
          if (parts.length > 2 || hostname.includes('localhost')) {
            const mainDomain = parts.slice(-2).join('.');
            const loginUrl = hostname.includes('localhost')
              ? `${currentUrl.protocol}//localhost:${currentUrl.port}/#login`
              : `${currentUrl.protocol}//login.${mainDomain}`;
            window.location.href = loginUrl;
          } else {
            setShowLanding(false);
          }
        } else {
          setShowLanding(false);
        }
          }} />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col">
        <AnnouncementBar />
        <LoginForm onBack={() => {
      if (subdomain === 'login') {
        const currentUrl = new URL(window.location.href);
        const hostname = currentUrl.hostname;
        const parts = hostname.split('.');
        if (parts.length > 2 || hostname.includes('localhost')) {
          const mainDomain = parts.slice(-2).join('.');
          const homeUrl = hostname.includes('localhost')
            ? `${currentUrl.protocol}//localhost:${currentUrl.port}/`
            : `${currentUrl.protocol}//home.${mainDomain}`;
          window.location.href = homeUrl;
        } else {
          setShowLanding(true);
        }
      } else {
        setShowLanding(true);
      }
    }} />
      </div>
    );
  }

  // Product detail page for logged-out users: render with app-style header
  if (!user && activeTab === 'product-detail' && productDetailId) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors">
        <AnnouncementBar />
        <ProductDetailPage
          productId={productDetailId}
          onBack={() => {
            setActiveTab('store');
            setProductDetailId(null);
            window.history.pushState(null, '', '#store');
          }}
          onGetStarted={() => {
            if (subdomain === 'home') {
              const currentUrl = new URL(window.location.href);
              const hostname = currentUrl.hostname;
              const parts = hostname.split('.');
              if (parts.length > 2 || hostname.includes('localhost')) {
                const mainDomain = parts.slice(-2).join('.');
                const loginUrl = hostname.includes('localhost')
                  ? `${currentUrl.protocol}//localhost:${currentUrl.port}/#login`
                  : `${currentUrl.protocol}//login.${mainDomain}`;
                window.location.href = loginUrl;
              } else {
                setShowLanding(false);
              }
            } else {
              setShowLanding(false);
            }
          }}
          onNavigate={setActiveTab}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors overflow-x-hidden">
      {/* Force nickname setup for users without a username */}
      {user && needsUsername && (
        <NicknameSetupModal
          userId={user.id}
          onComplete={(username) => setNeedsUsername(false)}
        />
      )}

      {/* Announcement Bar */}
      <AnnouncementBar />

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 sm:py-4 lg:py-6">
            <div className="flex items-center">
              {/* Mobile menu button */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                }}
                className="lg:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors mr-3 touch-manipulation"
                aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
              
              {/* Mobile Logo/Text */}
              <button
                onClick={() => {
                  setActiveTab('store');
                  window.history.pushState(null, '', '#store');
                }}
                className="sm:hidden flex items-center hover:opacity-80 transition-opacity"
              >
                {siteSettings?.header_logo_url || storeConfig?.store_logo_url ? (
                  <img
                    src={siteSettings?.header_logo_url || storeConfig?.store_logo_url}
                    alt="Logo"
                    className="h-6 w-6 object-cover rounded-lg mr-2"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-1.5 rounded-lg mr-2">
                    <CreditCard className="h-3 w-3 text-white" />
                  </div>
                )}
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {siteSettings?.site_name || storeConfig?.store_name || 'StreamManager'}
                </span>
              </button>

              {/* Desktop Logo */}
              <button
                onClick={() => {
                  setActiveTab('store');
                  window.history.pushState(null, '', '#store');
                }}
                className="hidden sm:flex items-center hover:opacity-80 transition-opacity"
              >
                {siteSettings?.header_logo_url || storeConfig?.store_logo_url ? (
                  <img
                    src={siteSettings?.header_logo_url || storeConfig?.store_logo_url}
                    alt="Logo"
                    className="h-8 w-8 object-cover rounded-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg ${siteSettings?.header_logo_url || storeConfig?.store_logo_url ? 'hidden' : ''}`}>
                  <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
                </div>
                <span className="ml-3 text-xl font-bold text-gray-900 dark:text-white">
                  {siteSettings?.site_name || storeConfig?.store_name || 'StreamManager'}
                </span>
              </button>

              {/* Desktop Navigation Buttons */}
              <nav className="hidden md:flex items-center gap-1 ml-2">
                {headerNavigation.map((item) => {
                  const IconComponent = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as ActiveTab);
                        window.history.pushState(null, '', `#${item.id}`);
                      }}
                      className={`relative flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <IconComponent className="h-4 w-4" />
                      <span className="hidden lg:inline">{item.name}</span>
                      {item.id === 'community' && communityUnreadCount > 0 && (
                        <span className="flex items-center justify-center min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
                          {communityUnreadCount > 9 ? '9+' : communityUnreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              {/* Chat Button */}
              <button
                onClick={() => { setActiveTab('messages'); window.history.pushState(null, '', '#messages'); }}
                className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
                title={t.language === 'pt' ? 'Mensagens' : t.language === 'en' ? 'Messages' : 'Mensajes'}
              >
                <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                {chatUnreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 bg-blue-500 text-white text-[10px] font-bold rounded-full">
                    {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                  </span>
                )}
              </button>
              <NotificationCenter />
              <UserMenu onNavigate={setActiveTab} isAdmin={isAdmin} isSeller={isSeller} />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-gray-600 bg-opacity-50 backdrop-blur-sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsMobileMenuOpen(false);
          }}
        >
          <div
            className="fixed inset-y-0 left-0 w-72 sm:w-80 bg-white dark:bg-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setActiveTab('store');
                  window.history.pushState(null, '', '#store');
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center hover:opacity-80 transition-opacity"
              >
                {siteSettings?.header_logo_url || storeConfig?.store_logo_url ? (
                  <img
                    src={siteSettings?.header_logo_url || storeConfig?.store_logo_url}
                    alt="Logo"
                    className="h-8 w-8 object-cover rounded-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg ${siteSettings?.header_logo_url || storeConfig?.store_logo_url ? 'hidden' : ''}`}>
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <span className="ml-3 text-lg font-bold text-gray-900 dark:text-white">
                  {siteSettings?.site_name || storeConfig?.store_name || 'StreamManager'}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsMobileMenuOpen(false);
                }}
                className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <nav className="mt-4 px-4">
              <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-hide">
                {headerNavigation.map((item) => {
                  const IconComponent = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as ActiveTab);
                        window.history.pushState(null, '', `#${item.id}`);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center">
                        <IconComponent className={`mr-3 h-4 w-4 ${isActive ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} />
                        {item.name}
                      </div>
                      {item.id === 'community' && communityUnreadCount > 0 && (
                        <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full">
                          {communityUnreadCount > 9 ? '9+' : communityUnreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Messages */}
                <button
                  onClick={() => {
                    setActiveTab('messages');
                    window.history.pushState(null, '', '#messages');
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === 'messages'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center">
                    <MessageCircle className={`mr-3 h-4 w-4 ${activeTab === 'messages' ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} />
                    {t.language === 'pt' ? 'Mensagens' : t.language === 'en' ? 'Messages' : 'Mensajes'}
                  </div>
                  {chatUnreadCount > 0 && (
                    <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-blue-500 text-white text-xs font-bold rounded-full">
                      {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                    </span>
                  )}
                </button>
              </div>
            </nav>

          </div>
        </div>
      )}

      <div className="flex-1 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8 w-full min-w-0">
        {activeTab === 'product-detail' && productDetailId ? (
          <ProductDetailPage
            productId={productDetailId}
            onBack={() => {
              setActiveTab('store');
              setProductDetailId(null);
              window.history.pushState(null, '', '#store');
            }}
            onGetStarted={() => {
              setShowLanding(false);
            }}
            onNavigate={setActiveTab}
          />
        ) : (
        <div className="min-w-0">
          {/* Main Content - full width, no sidebar */}
          <main className="min-w-0 max-w-full">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-2 sm:p-4 lg:p-6 transition-colors min-w-0 overflow-x-hidden">
              {renderContent()}
            </div>
          </main>
        </div>
        )}
      </div>

      {/* Footer */}
      <Footer />

      {/* Expiring Items Chat */}
      <ExpiringItemsChat />

      {/* Admin Flying Balloon (stacked above expiring items chat) */}
      <FlyingBalloon bottomOffset={96} />

      {/* Admin Popups */}
      <PopupDisplay />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <CurrencyProvider>
          <AuthProvider>
            <NotificationProvider>
              <AppContent />
            </NotificationProvider>
          </AuthProvider>
        </CurrencyProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}