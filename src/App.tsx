import React, { useState, useEffect } from 'react';
import { CreditCard, Play, Settings, Menu, X, User, ShoppingBag, Mail, Shield, Moon, Sun, TrendingUp, Newspaper, Users, HelpCircle, LogIn, Search, Wallet, Gamepad2 } from 'lucide-react';
import { useNotifications } from './hooks/useNotifications';
import { supabase } from './lib/supabase';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { BannedScreen } from './components/BannedScreen';
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
import { CheckoutPage } from './components/CheckoutPage';
import { AdminProductsManager } from './components/AdminProductsManager';
import { UserPurchases } from './components/UserPurchases';
import { Package } from 'lucide-react';
import { AccountsAccessGuard } from './components/AccountsAccessGuard';
import AdminUsersManager from './components/AdminUsersManager';
import AdminAppealsManager from './components/AdminAppealsManager';
import AdminSettingsManager from './components/AdminSettingsManager';
import AdminSiteSettingsManager from './components/AdminSiteSettingsManager';
import { AdminSecurityCenter } from './components/AdminSecurityCenter';

import { AccountsAccessManager } from './components/AccountsAccessManager';
import { MessageCircle } from 'lucide-react';
import { SupportSystem } from './components/SupportSystem';
import { AdminSupportManager } from './components/AdminSupportManager';
import { AdminDisputeManager } from './components/AdminDisputeManager';
import { UserProfile } from './components/UserProfile';
import { CreditsManager } from './components/CreditsManager';
import { DollarSign } from 'lucide-react';
import AdminPaymentManager from './components/AdminPaymentManager';
import { AdminCreditManager } from './components/AdminCreditManager';
import { AffiliateSystem } from './components/AffiliateSystem';
import { AdminSalesManager } from './components/AdminSalesManager';
import { AdminWithdrawalManager } from './components/AdminWithdrawalManager';
import { AdminEmailVerifier } from './components/AdminEmailVerifier';
import { FeesPage } from './components/FeesPage';
import { Footer } from './components/Footer';
import { AdminDashboard } from './components/AdminDashboard';
import { FeesPage } from './components/FeesPage';
import { WorkWithUsPage } from './components/WorkWithUsPage';
import { SMMPanel } from './components/SMMPanel';
import { AdminSMMManager } from './components/AdminSMMManager';
import { AdminSMMProviders } from './components/AdminSMMProviders';
import { AdminSMMOrders } from './components/AdminSMMOrders';
import AdminCommunityManager from './components/AdminCommunityManager';
import Blog from './components/Blog';
import { AdminSellerRequests } from './components/AdminSellerRequests';
import { ExpiringItemsChat } from './components/ExpiringItemsChat';
import { FlyingBalloon } from './components/FlyingBalloon';
import { AdminNetflixAccounts } from './components/AdminNetflixAccounts';
import { AdminNotificationsManager } from './components/AdminNotificationsManager';
import { AdminEmailTemplatesManager } from './components/AdminEmailTemplatesManager';
import AdminPopupManager from './components/AdminPopupManager';
import AdminFlyingBalloonManager from './components/AdminFlyingBalloonManager';
import { NotificationsPage } from './components/NotificationsPage';
import { SellerStore } from './components/SellerStore';
import { PublicSellerProfilePage } from './components/PublicSellerProfilePage';
import { PublicProfilePage } from './components/PublicProfilePage';
import { AdminGuard } from './components/AdminGuard';
import { PopupDisplay } from './components/PopupDisplay';
import { AnnouncementBar } from './components/AnnouncementBar';
import { AdminAnnouncementManager } from './components/AdminAnnouncementManager';
import { AdminBannerManager } from './components/AdminBannerManager';
import { AdminCouponsManager } from './components/AdminCouponsManager';
import { NicknameSetupModal } from './components/NicknameSetupModal';
import { ChatInbox } from './components/ChatInbox';

import { AdminProductCategoriesManager } from './components/AdminProductCategoriesManager';
import { CategorySearchPage } from './components/CategorySearchPage';
import { SearchResultsPage } from './components/SearchResultsPage';
import { GameCategoriesPage } from './components/GameCategoriesPage';
import { SellerRecruitmentPage } from './components/SellerRecruitmentPage';
import { PlusCircle } from 'lucide-react';
import { useOnlineHeartbeat } from './hooks/useOnlineStatus';

type ActiveTab = 'store' | 'accounts' | 'clients' | 'sellers' | 'services' | 'admin-products' | 'admin-product-categories' | 'purchases' | 'admin-users' | 'admin-appeals' | 'admin-settings' | 'admin-site-settings' | 'admin-security' | 'accounts-access' | 'support' | 'admin-support' | 'admin-disputes' | 'profile' | 'credits' | 'admin-payments' | 'admin-credits' | 'affiliates' | 'admin-sales' | 'admin-withdrawals' | 'admin-coupons' | 'email-verifier' | 'admin-dashboard' | 'smm' | 'admin-smm' | 'admin-smm-providers' | 'admin-smm-orders' | 'community' | 'admin-community' | 'blog' | 'game-categories' | 'seller-recruitment' | 'seller-requests' | 'admin-netflix-accounts' | 'admin-notifications' | 'admin-popups' | 'admin-announcements' | 'admin-banners' | 'admin-flying-balloons' | 'admin-email-templates' | 'notifications' | 'seller-store' | 'seller-profile' | 'messages' | 'product-detail' | 'checkout' | 'user-profile' | 'category-search' | 'search-results' | 'fees-page' | 'work-with-us';

interface StoreConfig {
  store_name?: string;
  store_logo_url?: string;
}

function AppContent() {
  const { user, loading, isPasswordRecovery, isBanned, banReason } = useAuth();
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('store');
  const [presetRechargeAmount, setPresetRechargeAmount] = useState<number | undefined>(undefined);
  const [productDetailId, setProductDetailId] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState<{ productId: string; variationId: string; quantity: number } | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);

  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);
  const [siteSettings, setSiteSettings] = useState<{ site_name?: string; header_logo_url?: string; browser_title?: string; favicon_url?: string } | null>(null);
  const [sellerSlug, setSellerSlug] = useState<string | null>(null);
  const [profileIdentifier, setProfileIdentifier] = useState<string | null>(null);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [creditBalance, setCreditBalance] = useState(0);

  useEffect(() => {
    if (!user) { setCreditBalance(0); return; }
    let active = true;
    async function loadCredit() {
      try {
        const { data } = await supabase
          .from('user_credits')
          .select('balance')
          .eq('user_id', user!.id)
          .maybeSingle();
        if (active) setCreditBalance(data?.balance || 0);
      } catch { /* ignore */ }
    }
    loadCredit();
    const ch = supabase
      .channel(`credit-balance-watch:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_credits', filter: `user_id=eq.${user.id}` }, loadCredit)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

  const navigateToSearch = (q: string) => {
    const query = q.trim();
    setSearchQuery(query);
    setSearchInput(query);
    const path = `/search/${encodeURIComponent(query)}`;
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleCreateOffer = () => {
    if (isSeller) {
      setActiveTab('seller-store');
      window.history.pushState(null, '', '/seller-store');
    } else if (user) {
      setActiveTab('seller-recruitment');
      window.history.pushState(null, '', '/seller-recruitment');
    } else {
      setShowLoginModal(true);
    }
  };

  useOnlineHeartbeat(user?.id);

  const navigateWithRecharge = (tab: string, opts?: { presetAmount?: number }) => {
    if (tab === 'credits' && opts?.presetAmount) {
      setPresetRechargeAmount(opts.presetAmount);
    }
    setActiveTab(tab as ActiveTab);
    const dynamicRoutes = ['product-detail', 'user-profile', 'seller-profile', 'checkout', 'category-search', 'search-results'];
    if (!dynamicRoutes.includes(tab)) {
      window.history.pushState(null, '', `/${tab}`);
    }
  };

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
    loadStoreConfig();
  }, []);

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

  // Handle URL path changes (path-based routing)
  useEffect(() => {
    const handlePathChange = () => {
      const path = window.location.pathname.slice(1) || 'store';

      // Check if it's a user profile route
      if (path.startsWith('user/')) {
        const identifier = path.replace('user/', '');
        setProfileIdentifier(identifier);
        setSellerSlug(null);
        setActiveTab('user-profile');
      } else if (path.startsWith('seller/')) {
        const slug = path.replace('seller/', '');
        setSellerSlug(slug);
        setActiveTab('seller-profile');
      } else if (path.startsWith('product/')) {
        const productId = path.replace('product/', '');
        setProductDetailId(productId);
        setActiveTab('product-detail');
      } else if (path.startsWith('checkout/')) {
        const productId = path.replace('checkout/', '');
        const stored = sessionStorage.getItem('checkout_data');
        let parsed: { productId: string; variationId: string; quantity: number } | null = null;
        if (stored) {
          try { parsed = JSON.parse(stored); } catch {}
        }
        setCheckoutData(parsed || { productId, variationId: '', quantity: 1 });
        setActiveTab('checkout');
      } else if (path.startsWith('category/')) {
        const catSlug = path.replace('category/', '');
        setCategorySlug(catSlug);
        setActiveTab('category-search');
      } else if (path.startsWith('game-categories')) {
        setActiveTab('game-categories');
      } else if (path.startsWith('seller-recruitment')) {
        setActiveTab('seller-recruitment');
      } else if (path.startsWith('search/')) {
        const sq = decodeURIComponent(path.replace('search/', ''));
        setSearchQuery(sq);
        setActiveTab('search-results');
      } else if (path.startsWith('fees-page') || path.startsWith('fees')) {
        setActiveTab('fees-page');
      } else if (path.startsWith('work-with-us') || path.startsWith('careers')) {
        setActiveTab('work-with-us');
      } else if (path.startsWith('blog/')) {
        setActiveTab('blog');
      } else if (path.startsWith('seller-store/')) {
        setActiveTab('seller-store');
      } else if (path && path !== activeTab) {
        setSellerSlug(null);
        setProductDetailId(null);
        setProfileIdentifier(null);
        setActiveTab(path as ActiveTab);
      }
    };

    // Set initial tab from URL
    handlePathChange();

    // Listen for path changes (browser back/forward + manual dispatch)
    window.addEventListener('popstate', handlePathChange);
    return () => window.removeEventListener('popstate', handlePathChange);
  }, []);

  // Update URL when tab changes (skip routes with dynamic IDs)
  useEffect(() => {
    if (!loading && activeTab !== 'product-detail' && activeTab !== 'user-profile' && activeTab !== 'seller-profile' && activeTab !== 'checkout' && activeTab !== 'category-search' && activeTab !== 'search-results') {
      const currentPath = window.location.pathname.slice(1);
      if (currentPath !== activeTab) {
        window.history.pushState(null, '', `/${activeTab}`);
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

  const headerNavigation: { id: string; name: string; icon: typeof Newspaper }[] = [];

  const footerNavigation = [
    { id: 'game-categories', name: t.language === 'pt' ? 'Jogos' : t.language === 'en' ? 'Games' : 'Juegos', icon: Gamepad2 },
    { id: 'blog', name: t.language === 'pt' ? 'Blog' : t.language === 'en' ? 'Blog' : 'Blog', icon: Newspaper },

    { id: 'affiliates', name: t.language === 'pt' ? 'Afiliados' : t.language === 'en' ? 'Affiliates' : 'Afiliados', icon: Users },
    { id: 'accounts', name: t.language === 'pt' ? 'Streaming' : t.language === 'en' ? 'Streaming' : 'Streaming', icon: Play },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'admin-dashboard':
        return (
          <AdminGuard>
            <AdminDashboard onNavigate={navigateWithRecharge} />
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
        return <Store onNavigate={navigateWithRecharge} />;
      case 'smm':
        return <SMMPanel onNavigate={navigateWithRecharge} />;
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
      case 'admin-product-categories':
        return (
          <AdminGuard page="admin-product-categories">
            <AdminProductCategoriesManager />
          </AdminGuard>
        );
      case 'category-search':
        if (!categorySlug) return <Store onNavigate={navigateWithRecharge} />;
        return (
          <CategorySearchPage
            slug={categorySlug}
            onBack={() => {
              setActiveTab('store');
              setCategorySlug(null);
              window.history.pushState(null, '', '/store');
            }}
            onProductClick={(product: any) => {
              setProductDetailId(product.id);
              setActiveTab('product-detail');
              window.history.pushState(null, '', `/product/${product.id}`);
            }}
            onNavigate={navigateWithRecharge}
          />
        );
      case 'search-results':
        return (
          <SearchResultsPage
            query={searchQuery}
            onBack={() => {
              setActiveTab('store');
              setSearchQuery('');
              window.history.pushState(null, '', '/store');
            }}
            onProductClick={(product: any) => {
              setProductDetailId(product.id);
              setActiveTab('product-detail');
              window.history.pushState(null, '', `/product/${product.id}`);
            }}
            onNavigate={navigateWithRecharge}
          />
        );
      case 'credits':
        return <CreditsManager presetRechargeAmount={presetRechargeAmount} onRechargeComplete={() => setPresetRechargeAmount(undefined)} />;
      case 'purchases':
        return <UserPurchases />;
      case 'admin-users':
        return (
          <AdminGuard page="admin-users">
            <AdminUsersManager />
          </AdminGuard>
        );
      case 'admin-appeals':
        return (
          <AdminGuard page="admin-appeals">
            <AdminAppealsManager />
          </AdminGuard>
        );
      case 'admin-settings':
        return (
          <AdminGuard page="admin-settings">
            <AdminSettingsManager />
          </AdminGuard>
        );

      case 'admin-email-templates':
        return (
          <AdminGuard page="admin-email-templates">
            <AdminEmailTemplatesManager />
          </AdminGuard>
        );
      case 'admin-site-settings':
        return (
          <AdminGuard page="admin-site-settings">
            <AdminSiteSettingsManager />
          </AdminGuard>
        );
      case 'admin-security':
        return (
          <AdminGuard page="admin-security">
            <AdminSecurityCenter />
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
      case 'admin-disputes':
        return (
          <AdminGuard page="admin-disputes">
            <AdminDisputeManager />
          </AdminGuard>
        );
      case 'profile': {
        const ident = user?.id;
        if (ident) {
          window.history.pushState(null, '', `/user/${ident}`);
          window.dispatchEvent(new PopStateEvent('popstate'));
          return null;
        }
        return <UserProfile onNavigate={navigateWithRecharge} />;
      }
      case 'user-profile':
        if (!profileIdentifier) return <Store onNavigate={navigateWithRecharge} />;
        return (
          <PublicProfilePage
            identifier={profileIdentifier}
            onBack={() => {
              setActiveTab('store');
              setProfileIdentifier(null);
              window.history.pushState(null, '', '/store');
            }}
            onNavigate={navigateWithRecharge}
          />
        );
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
      case 'blog':
        return <Blog onNavigate={navigateWithRecharge} />;
      case 'game-categories':
        return (
          <GameCategoriesPage
            onBack={() => {
              setActiveTab('store');
              window.history.pushState(null, '', '/store');
            }}
            onCategoryClick={(slug) => {
              setCategorySlug(slug);
              setActiveTab('category-search');
              window.history.pushState(null, '', `/category/${slug}`);
            }}
          />
        );
      case 'seller-recruitment':
        return (
          <SellerRecruitmentPage
            onBack={() => {
              setActiveTab('store');
              window.history.pushState(null, '', '/store');
            }}
            onBecomeSeller={() => {
              setActiveTab('seller-requests');
              window.history.pushState(null, '', '/seller-requests');
            }}
          />
        );
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
      case 'fees-page':
        return (
          <FeesPage
            onBack={() => {
              setActiveTab('store');
              window.history.pushState(null, '', '/store');
            }}
          />
        );
      case 'work-with-us':
        return (
          <WorkWithUsPage
            onBack={() => {
              setActiveTab('store');
              window.history.pushState(null, '', '/store');
            }}
          />
        );
      case 'seller-profile':
        if (!sellerSlug) return <Store onNavigate={navigateWithRecharge} />;
        return (
          <PublicSellerProfilePage
            sellerSlug={sellerSlug}
            onBack={() => {
              setActiveTab('store');
              setSellerSlug(null);
              window.history.pushState(null, '', '/store');
            }}
            onProductClick={(product: any) => {
              setProductDetailId(product.id);
              setActiveTab('product-detail');
              window.history.pushState(null, '', `/product/${product.id}`);
            }}
          />
        );
      case 'email-verifier':
        // Redirect to external URL
        window.open('https://streammanager.online/', '_blank');
        return <Store onNavigate={navigateWithRecharge} />;
      default:
        return <Store onNavigate={navigateWithRecharge} />;
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

  // Show banned screen if user is banned
  if (user && isBanned) {
    return <BannedScreen banReason={banReason} />;
  }

  // Search results page for logged-out users
  // Product detail page for logged-out users: render with app-style header
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors overflow-x-clip">
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
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
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
                  window.history.pushState(null, '', '/store');
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
                  window.history.pushState(null, '', '/store');
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
                        window.history.pushState(null, '', `/${item.id}`);
                      }}
                      className={`relative flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <IconComponent className="h-4 w-4" />
                      <span className="hidden lg:inline">{item.name}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Centered Desktop Search */}
            <div className="hidden md:flex flex-1 justify-center max-w-xl mx-4">
              <form
                onSubmit={(e) => { e.preventDefault(); navigateToSearch(searchInput); }}
                className="relative w-full"
              >
                <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                  <Search className="h-5 w-5" />
                </button>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t.language === 'pt' ? 'Buscar produtos, jogos, categorias...' : t.language === 'en' ? 'Search products, games, categories...' : 'Buscar productos, juegos, categorías...'}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => { setSearchInput(''); navigateToSearch(''); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </form>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              {/* Create Offer Button */}
              <button
                onClick={handleCreateOffer}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium shadow-sm transition-all"
                title={t.language === 'pt' ? 'Criar nova oferta' : t.language === 'en' ? 'Create new offer' : 'Crear nueva oferta'}
              >
                <PlusCircle className="h-4 w-4" />
                <span className="hidden lg:inline">{t.language === 'pt' ? 'Criar Oferta' : t.language === 'en' ? 'Create Offer' : 'Crear Oferta'}</span>
              </button>
              {/* Credit Balance */}
              {user && (
                <button
                  onClick={() => navigateWithRecharge('credits')}
                  className="hidden sm:flex items-center gap-2 px-2.5 lg:px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-sm transition-all"
                  title={t.language === 'pt' ? 'Seus créditos' : t.language === 'en' ? 'Your credits' : 'Tus créditos'}
                >
                  <Wallet className="h-4 w-4" />
                  <span className="text-sm font-bold">${creditBalance.toFixed(2)}</span>
                </button>
              )}
              {/* Chat Button - only for authenticated users */}
              {user && (
                <button
                  onClick={() => { setActiveTab('messages'); window.history.pushState(null, '', '/messages'); }}
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
              )}
              {user && <NotificationCenter />}
              {user ? (
                <UserMenu onNavigate={navigateWithRecharge} isAdmin={isAdmin} isSeller={isSeller} />
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={toggleTheme}
                    className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
                    title={theme === 'dark' ? (t.language === 'pt' ? 'Tema claro' : t.language === 'en' ? 'Light theme' : 'Tema claro') : (t.language === 'pt' ? 'Tema escuro' : t.language === 'en' ? 'Dark theme' : 'Tema oscuro')}
                  >
                    {theme === 'dark' ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
                  </button>
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                  >
                    <LogIn className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">{t.language === 'pt' ? 'Entrar' : t.language === 'en' ? 'Sign In' : 'Iniciar Sesion'}</span>
                  </button>
                </div>
              )}
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
                  window.history.pushState(null, '', '/store');
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

            {/* Mobile Search */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <form
                onSubmit={(e) => { e.preventDefault(); navigateToSearch(searchInput); setIsMobileMenuOpen(false); }}
                className="relative"
              >
                <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                  <Search className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t.language === 'pt' ? 'Buscar produtos, jogos, categorias...' : t.language === 'en' ? 'Search products, games, categories...' : 'Buscar productos, juegos, categorías...'}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                />
              </form>
              {user && (
                <button
                  onClick={() => { navigateWithRecharge('credits'); setIsMobileMenuOpen(false); }}
                  className="mt-3 w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-sm transition-all"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Wallet className="h-4 w-4" />
                    {t.language === 'pt' ? 'Saldo' : t.language === 'en' ? 'Balance' : 'Saldo'}
                  </span>
                  <span className="text-sm font-bold">${creditBalance.toFixed(2)}</span>
                </button>
              )}
            </div>

            {/* Create Offer Button */}
            <div className="px-4 pb-2">
              <button
                onClick={() => { handleCreateOffer(); setIsMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium shadow-sm transition-all"
              >
                <PlusCircle className="h-4 w-4" />
                {t.language === 'pt' ? 'Criar Oferta' : t.language === 'en' ? 'Create Offer' : 'Crear Oferta'}
              </button>
            </div>

            <nav className="mt-4 px-4">
              <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-hide">
                {/* Messages */}
                <button
                  onClick={() => {
                    setActiveTab('messages');
                    window.history.pushState(null, '', '/messages');
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

      <div className="flex-1 w-full mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8 w-full min-w-0">
        {activeTab === 'product-detail' && productDetailId ? (
          <ProductDetailPage
            productId={productDetailId}
            onBack={() => {
              setActiveTab('store');
              setProductDetailId(null);
              window.history.pushState(null, '', '/store');
            }}
            onGetStarted={() => {
              setShowLoginModal(true);
            }}
            onNavigate={navigateWithRecharge}
          />
        ) : activeTab === 'checkout' && checkoutData ? (
          <CheckoutPage
            productId={checkoutData.productId}
            variationId={checkoutData.variationId || undefined}
            quantity={checkoutData.quantity}
            onBack={() => {
              setActiveTab('store');
              setCheckoutData(null);
              window.history.pushState(null, '', '/store');
            }}
            onSuccess={() => {
              setActiveTab('purchases');
              setCheckoutData(null);
              window.history.pushState(null, '', '/purchases');
            }}
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
      <Footer
        navigationLinks={footerNavigation}
        onNavigate={(id) => {
          setActiveTab(id as ActiveTab);
          window.history.pushState(null, '', `/${id}`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Expiring Items Chat */}
      <ExpiringItemsChat />

      {/* Admin Flying Balloon (stacked above expiring items chat) */}
      <FlyingBalloon bottomOffset={96} />

      {/* Admin Popups */}
      <PopupDisplay />

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