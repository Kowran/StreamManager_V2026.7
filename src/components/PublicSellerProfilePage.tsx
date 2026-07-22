import React, { useState, useEffect, useMemo } from 'react';
import {
  Star, Package, Calendar, ShoppingBag, TrendingUp, Award, CheckCircle,
  ArrowLeft, MessageCircle, User, Store, Ban, MapPin, Clock, Zap,
  Truck, ChevronRight, Sparkles, BadgeCheck, ThumbsUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchSellerBySlug, fetchSellerInfo } from '../lib/sellerInfo';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';
import { useCurrency } from './CurrencyProvider';
import { ProductRatingsDisplay } from './ProductRatingsDisplay';
import { SellerReputation } from './SellerReputation';
import { OnlineBadge } from './OnlineBadge';
import { ChatModal } from './ChatModal';
import { LevelBadge } from './LevelBadge';

interface PublicSellerProfilePageProps {
  sellerSlug: string;
  onBack: () => void;
  onProductClick?: (product: SellerProduct) => void;
}

interface SellerProfile {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  cover_url?: string;
  bio?: string;
  theme_color?: string;
  profile_badge?: string;
  created_at: string;
  role: string;
  seller_slug: string;
  username?: string;
  last_seen_at?: string;
  login_count?: number;
  last_login_at?: string;
  user_level?: number | null;
  user_xp?: number | null;
  seller_level?: number | null;
  seller_xp?: number | null;
}

interface SellerStats {
  total_sales: number;
  active_products: number;
  average_rating: number;
  total_reviews: number;
  member_since_days: number;
}

interface SellerProduct {
  id: string;
  name: string;
  description: string;
  price_usdt: number;
  promotional_price_usdt?: number | null;
  promotion_active?: boolean;
  image_url?: string;
  category: string;
  primary_category?: string;
  active: boolean;
  stock_quantity: number;
  manual_delivery?: boolean;
  account_recharge?: boolean;
  delivery_time?: string;
  slug?: string;
}

interface ProductRating {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  buyer_name: string;
  product_name: string;
}

interface UserRating {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  rater_name: string;
  rater_role: string;
}

type TabId = 'products' | 'reviews' | 'seller-reviews' | 'customer-reviews';

export function PublicSellerProfilePage({ sellerSlug, onBack, onProductClick }: PublicSellerProfilePageProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [ratings, setRatings] = useState<ProductRating[]>([]);
  const [userRatingsAsSeller, setUserRatingsAsSeller] = useState<UserRating[]>([]);
  const [userRatingsAsCustomer, setUserRatingsAsCustomer] = useState<UserRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('products');
  const [productFilter, setProductFilter] = useState<string>('all');

  useEffect(() => {
    loadSellerData();
  }, [sellerSlug]);

  useEffect(() => {
    if (profile && user) checkBlockStatus();
  }, [profile, user]);

  async function checkBlockStatus() {
    if (!user || !profile) return;
    const { data } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', profile.id)
      .maybeSingle();
    setIsBlocked(!!data);
  }

  async function toggleBlock() {
    if (!user || !profile || blockLoading) return;
    setBlockLoading(true);
    try {
      if (isBlocked) {
        await supabase.from('blocked_users').delete().eq('blocker_id', user.id).eq('blocked_id', profile.id);
        setIsBlocked(false);
      } else {
        await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: profile.id });
        setIsBlocked(true);
      }
    } catch (err) {
      console.error('Error toggling block:', err);
    } finally {
      setBlockLoading(false);
    }
  }

  async function loadSellerData() {
    try {
      setLoading(true);
      setError(null);

      const profileData = await fetchSellerBySlug(sellerSlug);

      if (!profileData) {
        setError(t.language === 'pt' ? 'Vendedor não encontrado' :
                t.language === 'en' ? 'Seller not found' :
                'Vendedor no encontrado');
        return;
      }

      if (profileData.role !== 'seller' && profileData.role !== 'admin') {
        setError(t.language === 'pt' ? 'Perfil não é de um vendedor' :
                t.language === 'en' ? 'Profile is not a seller' :
                'El perfil no es de un vendedor');
        return;
      }

      setProfile(profileData);
      await Promise.all([
        loadSellerStats(profileData.id),
        loadSellerProducts(profileData.id),
        loadSellerRatings(profileData.id),
        loadUserRatings(profileData.id),
      ]);
    } catch {
      setError(t.language === 'pt' ? 'Erro ao carregar dados do vendedor' :
              t.language === 'en' ? 'Error loading seller data' :
              'Error al cargar los datos del vendedor');
    } finally {
      setLoading(false);
    }
  }

  async function loadSellerStats(sellerId: string) {
    try {
      const { data: salesCountData } = await supabase
        .rpc('get_seller_sales_count', { seller_uuid: sellerId });
      const totalSales = Number(salesCountData) || 0;

      const { count: activeProducts } = await supabase
        .from('store_products')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', sellerId)
        .eq('active', true);

      const { data: ratingsData } = await supabase
        .from('product_ratings')
        .select('rating, store_products!inner(seller_id)')
        .eq('store_products.seller_id', sellerId);

      const avgRating = ratingsData && ratingsData.length > 0
        ? ratingsData.reduce((sum, r) => sum + r.rating, 0) / ratingsData.length
        : 0;

      const memberSince = profile?.created_at
        ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      setStats({
        total_sales: totalSales,
        active_products: activeProducts || 0,
        average_rating: avgRating,
        total_reviews: ratingsData?.length || 0,
        member_since_days: memberSince
      });
    } catch (error) {
      console.error('Error in loadSellerStats:', error);
    }
  }

  async function loadSellerProducts(sellerId: string) {
    try {
      const { data, error } = await supabase
        .from('store_products')
        .select('*')
        .eq('seller_id', sellerId)
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error in loadSellerProducts:', error);
    }
  }

  async function loadSellerRatings(sellerId: string) {
    try {
      const { data: ratingsWithDetails, error } = await supabase
        .from('product_ratings')
        .select(`*, store_products!inner(name, seller_id)`)
        .eq('store_products.seller_id', sellerId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (ratingsWithDetails && ratingsWithDetails.length > 0) {
        const userIds = [...new Set(ratingsWithDetails.map((r: any) => r.user_id))] as string[];
        const profilesMap = await fetchSellerInfo(userIds);
        const profileMap = new Map(Object.entries(profilesMap).map(([id, s]) => [id, s.full_name || 'Anonymous']));

        setRatings(ratingsWithDetails.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment || '',
          created_at: r.created_at,
          buyer_name: profileMap.get(r.user_id) || 'Anonymous',
          product_name: r.store_products?.name || ''
        })));
      } else {
        setRatings([]);
      }
    } catch (error) {
      console.error('Error in loadSellerRatings:', error);
    }
  }

  async function loadUserRatings(userId: string) {
    try {
      const { data: sellerRatings } = await supabase
        .from('user_ratings')
        .select('id, rating, comment, created_at, rater_role, rater_id')
        .eq('rated_user_id', userId)
        .eq('rater_role', 'customer')
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: customerRatings } = await supabase
        .from('user_ratings')
        .select('id, rating, comment, created_at, rater_role, rater_id')
        .eq('rated_user_id', userId)
        .eq('rater_role', 'seller')
        .order('created_at', { ascending: false })
        .limit(20);

      const allRaterIds = [...new Set([...(sellerRatings || []), ...(customerRatings || [])].map(r => r.rater_id))] as string[];
      let profileMap = new Map<string, string>();
      if (allRaterIds.length > 0) {
        const profilesMap = await fetchSellerInfo(allRaterIds);
        profileMap = new Map(Object.entries(profilesMap).map(([id, s]) => [id, s.full_name || 'Anonymous']));
      }

      if (sellerRatings) {
        setUserRatingsAsSeller(sellerRatings.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment || '',
          created_at: r.created_at,
          rater_name: profileMap.get(r.rater_id) || 'Anonymous',
          rater_role: r.rater_role,
        })));
      }

      if (customerRatings) {
        setUserRatingsAsCustomer(customerRatings.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment || '',
          created_at: r.created_at,
          rater_name: profileMap.get(r.rater_id) || 'Anonymous',
          rater_role: r.rater_role,
        })));
      }
    } catch (error) {
      console.error('Error in loadUserRatings:', error);
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString(
      t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES',
      { year: 'numeric', month: 'short', day: 'numeric' }
    );
  }

  function getRoleLabel(role: string) {
    const labels: Record<string, string> = {
      admin: t.language === 'pt' ? 'Administrador' : t.language === 'en' ? 'Administrator' : 'Administrador',
      seller: t.language === 'pt' ? 'Vendedor' : t.language === 'en' ? 'Seller' : 'Vendedor',
      customer: t.language === 'pt' ? 'Cliente' : t.language === 'en' ? 'Customer' : 'Cliente',
    };
    return labels[role] || role;
  }

  const themeColor = profile?.theme_color || '#2563eb';
  const themeColorSoft = `${themeColor}1a`;
  const themeColorMedium = `${themeColor}55`;

  // Product categories for filter chips
  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => { if (p.category) cats.add(p.category); });
    return ['all', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (productFilter === 'all') return products;
    return products.filter(p => p.category === productFilter);
  }, [products, productFilter]);

  // Rating distribution for reviews tab
  const ratingDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    ratings.forEach(r => { if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++; });
    return dist;
  }, [ratings]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t.language === 'pt' ? 'Carregando perfil...' :
           t.language === 'en' ? 'Loading profile...' :
           'Cargando perfil...'}
        </p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="text-center py-20 max-w-md mx-auto">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
          <Package className="h-8 w-8 text-gray-400" />
        </div>
        <p className="text-gray-600 dark:text-gray-300 font-medium">{error || (t.language === 'pt' ? 'Perfil não encontrado' : 'Profile not found')}</p>
        <button
          onClick={onBack}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.language === 'pt' ? 'Voltar' : t.language === 'en' ? 'Back' : 'Volver'}
        </button>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: typeof Package; count: number }[] = [
    { id: 'products', label: t.language === 'pt' ? 'Produtos' : t.language === 'en' ? 'Products' : 'Productos', icon: Package, count: products.length },
    { id: 'reviews', label: t.language === 'pt' ? 'Avaliações de Produtos' : t.language === 'en' ? 'Product Reviews' : 'Reseñas de Productos', icon: Star, count: ratings.length },
    { id: 'seller-reviews', label: t.language === 'pt' ? 'Como Vendedor' : t.language === 'en' ? 'As Seller' : 'Como Vendedor', icon: ShoppingBag, count: userRatingsAsSeller.length },
    { id: 'customer-reviews', label: t.language === 'pt' ? 'Como Cliente' : t.language === 'en' ? 'As Customer' : 'Como Cliente', icon: User, count: userRatingsAsCustomer.length },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      {/* Back button */}
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
        {t.language === 'pt' ? 'Voltar para a loja' : t.language === 'en' ? 'Back to store' : 'Volver a la tienda'}
      </button>

      {/* Hero / Cover Card */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
        {/* Cover */}
        <div className="relative h-44 sm:h-56 md:h-64">
          {profile.cover_url ? (
            <img src={profile.cover_url} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full relative"
              style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColorMedium} 60%, ${themeColorSoft} 100%)` }}
            >
              <div
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage: `radial-gradient(circle at 15% 50%, white 1.5px, transparent 1.5px), radial-gradient(circle at 85% 25%, white 1.5px, transparent 1.5px), radial-gradient(circle at 50% 80%, white 1px, transparent 1px)`,
                  backgroundSize: '50px 50px, 60px 60px, 30px 30px',
                }}
              />
              {/* Decorative glow */}
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-30 blur-3xl" style={{ background: themeColor }} />
            </div>
          )}
          {/* Gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>

        {/* Avatar + identity */}
        <div className="px-5 sm:px-8 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-14 sm:-mt-16 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              {/* Avatar */}
              <div className="relative group flex-shrink-0">
                <div
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl border-4 border-white dark:border-gray-800 shadow-xl overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
                >
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-3xl sm:text-4xl font-bold text-white">
                        {profile.full_name?.charAt(0).toUpperCase() || <User className="h-10 w-10 text-white" />}
                      </span>
                    </div>
                  )}
                </div>
                {/* Verified badge */}
                <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1.5 border-2 border-white dark:border-gray-800 shadow-md">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              </div>

              {/* Name + badges */}
              <div className="space-y-2 sm:pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                    {profile.full_name || 'Vendedor'}
                  </h1>
                  {profile.profile_badge && (
                    <span
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full text-white shadow-sm"
                      style={{ backgroundColor: themeColor }}
                    >
                      <Sparkles className="w-3 h-3" />
                      {profile.profile_badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <Store className="w-3 h-3" />
                    {getRoleLabel(profile.role)}
                  </span>
                  {profile.user_level != null && (
                    <LevelBadge level={profile.user_level} type="user" size="sm" showLabel />
                  )}
                  {(profile.role === 'seller' || profile.role === 'admin') && profile.seller_level != null && (
                    <LevelBadge level={profile.seller_level} type="seller" size="sm" showLabel />
                  )}
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    <BadgeCheck className="w-3 h-3" />
                    {t.language === 'pt' ? 'Verificado' : t.language === 'en' ? 'Verified' : 'Verificado'}
                  </span>
                </div>
                {/* Online + member since */}
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                  <OnlineBadge lastSeenAt={profile.last_seen_at} language={t.language} showLabel size="sm" />
                  {stats && stats.member_since_days > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {t.language === 'pt' ? `Membro há ${stats.member_since_days} dias` :
                       t.language === 'en' ? `Member for ${stats.member_since_days} days` :
                       `Miembro por ${stats.member_since_days} días`}
                    </span>
                  )}
                  {profile.username && (
                    <span className="inline-flex items-center gap-1">
                      <span className="opacity-60">@</span>{profile.username}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            {user && user.id !== profile.id && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setChatOpen(true)}
                  disabled={isBlocked}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl text-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
                >
                  <MessageCircle className="h-4 w-4" />
                  {t.language === 'pt' ? 'Enviar mensagem' : t.language === 'en' ? 'Send message' : 'Enviar mensaje'}
                </button>
                <button
                  onClick={toggleBlock}
                  disabled={blockLoading}
                  className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-xl border transition-colors ${
                    isBlocked
                      ? 'border-green-200 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title={isBlocked ? (t.language === 'pt' ? 'Desbloquear' : 'Unblock') : (t.language === 'pt' ? 'Bloquear' : 'Block')}
                >
                  <Ban className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mt-5 p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed italic">
                "{profile.bio}"
              </p>
            </div>
          )}

          {/* Stats grid */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<ShoppingBag className="h-5 w-5" />}
              value={stats?.total_sales || 0}
              label={t.language === 'pt' ? 'Vendas' : t.language === 'en' ? 'Sales' : 'Ventas'}
              color={themeColor}
            />
            <StatCard
              icon={<Package className="h-5 w-5" />}
              value={stats?.active_products || 0}
              label={t.language === 'pt' ? 'Produtos' : t.language === 'en' ? 'Products' : 'Productos'}
              color="#10b981"
            />
            <StatCard
              icon={<Star className="h-5 w-5" />}
              value={stats?.average_rating.toFixed(1) || '0.0'}
              label={t.language === 'pt' ? 'Avaliação' : t.language === 'en' ? 'Rating' : 'Calificación'}
              color="#f59e0b"
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              value={stats?.total_reviews || 0}
              label={t.language === 'pt' ? 'Avaliações' : t.language === 'en' ? 'Reviews' : 'Reseñas'}
              color="#8b5cf6"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 rounded-3xl shadow-sm bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-100 dark:border-gray-700 scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors relative ${
                activeTab === tab.id
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`} style={activeTab === tab.id ? { backgroundColor: themeColor } : {}}>
                {tab.count}
              </span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: themeColor }} />
              )}
            </button>
          ))}
        </div>

        <div className="p-5 sm:p-7">
          {/* PRODUCTS TAB */}
          {activeTab === 'products' && (
            <div>
              {products.length === 0 ? (
                <EmptyState
                  icon={<Package className="h-12 w-12 text-gray-300 dark:text-gray-600" />}
                  message={t.language === 'pt' ? 'Nenhum produto disponível' :
                           t.language === 'en' ? 'No products available' :
                           'No hay productos disponibles'}
                />
              ) : (
                <>
                  {/* Category filter chips */}
                  {productCategories.length > 2 && (
                    <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                      {productCategories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setProductFilter(cat)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                            productFilter === cat
                              ? 'text-white shadow-sm'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                          style={productFilter === cat ? { backgroundColor: themeColor } : {}}
                        >
                          {cat === 'all'
                            ? (t.language === 'pt' ? 'Todos' : t.language === 'en' ? 'All' : 'Todos')
                            : cat}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredProducts.map((product) => {
                      const available = (product as any).manual_delivery || product.stock_quantity > 0;
                      const hasPromo = product.promotion_active && product.promotional_price_usdt;
                      const price = hasPromo ? Number(product.promotional_price_usdt) : Number(product.price_usdt);
                      return (
                        <div
                          key={product.id}
                          onClick={() => onProductClick?.(product)}
                          className="group bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                        >
                          <div className="relative aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-gray-700">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800">
                                <Package className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                              </div>
                            )}
                            {/* Category badge */}
                            <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/50 backdrop-blur-sm text-white capitalize">
                              {product.category}
                            </span>
                            {/* Availability badge */}
                            {!available ? (
                              <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-500 text-white">
                                {t.language === 'pt' ? 'Esgotado' : t.language === 'en' ? 'Sold Out' : 'Agotado'}
                              </span>
                            ) : (
                              <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-green-500 text-white">
                                {t.language === 'pt' ? 'Disponível' : t.language === 'en' ? 'Available' : 'Disponible'}
                              </span>
                            )}
                            {/* Delivery type badge */}
                            <div className="absolute bottom-2.5 left-2.5">
                              {(product as any).manual_delivery ? (
                                (product as any).account_recharge ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/90 backdrop-blur-sm text-white">
                                    <Zap className="h-2.5 w-2.5" />
                                    {t.language === 'pt' ? 'Recarga' : t.language === 'en' ? 'Recharge' : 'Recarga'}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/90 backdrop-blur-sm text-white">
                                    <Truck className="h-2.5 w-2.5" />
                                    {t.language === 'pt' ? 'Manual' : t.language === 'en' ? 'Manual' : 'Manual'}
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/90 backdrop-blur-sm text-white">
                                  <Zap className="h-2.5 w-2.5" />
                                  {t.language === 'pt' ? 'Automático' : t.language === 'en' ? 'Automatic' : 'Automático'}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="p-4">
                            <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1.5 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {product.name}
                            </h3>
                            {product.description && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 leading-relaxed">
                                {product.description}
                              </p>
                            )}

                            {/* Rating */}
                            <div className="mb-3">
                              <ProductRatingsDisplay productId={product.id} showTitle={false} compact={true} />
                            </div>

                            {/* Price */}
                            <div className="flex items-baseline gap-2">
                              {hasPromo && (
                                <span className="text-xs text-gray-400 line-through">
                                  {formatPrice(Number(product.price_usdt))}
                                </span>
                              )}
                              <span className="text-lg font-bold text-gray-900 dark:text-white">
                                {formatPrice(price)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {filteredProducts.length === 0 && (
                    <EmptyState
                      icon={<Package className="h-12 w-12 text-gray-300 dark:text-gray-600" />}
                      message={t.language === 'pt' ? 'Nenhum produto nesta categoria' :
                               t.language === 'en' ? 'No products in this category' :
                               'No hay productos en esta categoría'}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* PRODUCT REVIEWS TAB */}
          {activeTab === 'reviews' && (
            <div>
              {ratings.length === 0 ? (
                <EmptyState
                  icon={<Star className="h-12 w-12 text-gray-300 dark:text-gray-600" />}
                  message={t.language === 'pt' ? 'Nenhuma avaliação ainda' :
                           t.language === 'en' ? 'No reviews yet' :
                           'Sin reseñas todavía'}
                />
              ) : (
                <div className="space-y-4">
                  {/* Rating distribution */}
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats?.average_rating.toFixed(1) || '0.0'}</div>
                        <div className="flex items-center gap-0.5 mt-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(stats?.average_rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
                          ))}
                        </div>
                      </div>
                      <div className="flex-1 space-y-1.5">
                        {[5, 4, 3, 2, 1].map((star) => {
                          const count = ratingDistribution[star - 1];
                          const pct = ratings.length > 0 ? (count / ratings.length) * 100 : 0;
                          return (
                            <div key={star} className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500 dark:text-gray-400 w-6">{star}★</span>
                              <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-amber-400 h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-gray-500 dark:text-gray-400 w-6 text-right">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Individual reviews */}
                  {ratings.map((rating) => (
                    <div key={rating.id} className="rounded-2xl p-4 bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-sm" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}aa)` }}>
                            {rating.buyer_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-medium text-sm text-gray-900 dark:text-white">{rating.buyer_name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{rating.product_name}</div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`h-3.5 w-3.5 ${i < rating.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
                            ))}
                          </div>
                          <span className="text-xs text-gray-400">{formatDate(rating.created_at)}</span>
                        </div>
                      </div>
                      {rating.comment && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">{rating.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SELLER REVIEWS TAB */}
          {activeTab === 'seller-reviews' && (
            <div>
              {userRatingsAsSeller.length === 0 ? (
                <EmptyState
                  icon={<ShoppingBag className="h-12 w-12 text-gray-300 dark:text-gray-600" />}
                  message={t.language === 'pt' ? 'Nenhuma avaliação como vendedor' :
                           t.language === 'en' ? 'No seller reviews yet' :
                           'Sin reseñas como vendedor'}
                />
              ) : (
                <div className="space-y-4">
                  {userRatingsAsSeller.map((rating) => (
                    <div key={rating.id} className="rounded-2xl p-4 bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full flex items-center justify-center bg-blue-500 text-white font-semibold text-sm">
                            {rating.rater_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-medium text-sm text-gray-900 dark:text-white">{rating.rater_name}</div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              {t.language === 'pt' ? 'Cliente' : t.language === 'en' ? 'Customer' : 'Cliente'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`h-3.5 w-3.5 ${i < rating.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
                            ))}
                          </div>
                          <span className="text-xs text-gray-400">{formatDate(rating.created_at)}</span>
                        </div>
                      </div>
                      {rating.comment && <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">{rating.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CUSTOMER REVIEWS TAB */}
          {activeTab === 'customer-reviews' && (
            <div>
              {userRatingsAsCustomer.length === 0 ? (
                <EmptyState
                  icon={<User className="h-12 w-12 text-gray-300 dark:text-gray-600" />}
                  message={t.language === 'pt' ? 'Nenhuma avaliação como cliente' :
                           t.language === 'en' ? 'No customer reviews yet' :
                           'Sin reseñas como cliente'}
                />
              ) : (
                <div className="space-y-4">
                  {userRatingsAsCustomer.map((rating) => (
                    <div key={rating.id} className="rounded-2xl p-4 bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full flex items-center justify-center bg-green-500 text-white font-semibold text-sm">
                            {rating.rater_name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-medium text-sm text-gray-900 dark:text-white">{rating.rater_name}</div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              {t.language === 'pt' ? 'Vendedor' : t.language === 'en' ? 'Seller' : 'Vendedor'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`h-3.5 w-3.5 ${i < rating.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
                            ))}
                          </div>
                          <span className="text-xs text-gray-400">{formatDate(rating.created_at)}</span>
                        </div>
                      </div>
                      {rating.comment && <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">{rating.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Seller Reputation */}
      <div className="mt-6">
        <SellerReputation sellerId={profile.id} sellerName={profile.full_name || profile.username || profile.seller_slug} />
      </div>

      {chatOpen && (
        <ChatModal otherUserId={profile.id} onClose={() => setChatOpen(false)} />
      )}
    </div>
  );
}

function StatCard({ icon, value, label, color }: { icon: React.ReactNode; value: React.ReactNode; label: string; color: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 transition-all hover:shadow-md">
      <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-10 blur-xl" style={{ background: color }} />
      <div className="relative">
        <div className="inline-flex items-center justify-center h-9 w-9 rounded-xl mb-2" style={{ backgroundColor: `${color}1a`, color }}>
          {icon}
        </div>
        <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center mb-3">{icon}</div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}
