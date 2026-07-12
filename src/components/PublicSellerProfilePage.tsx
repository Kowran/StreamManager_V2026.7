import React, { useState, useEffect } from 'react';
import { Star, Package, Calendar, ShoppingBag, TrendingUp, Award, CheckCircle, ArrowLeft, MessageCircle, User, Mail, Store } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';
import { ProductRatingsDisplay } from './ProductRatingsDisplay';
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
  last_seen_at?: string;
  login_count?: number;
  last_login_at?: string;
  seller_level?: number;
  seller_xp?: number;
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
  image_url?: string;
  category: string;
  active: boolean;
  stock_quantity: number;
  manual_delivery: boolean;
}

interface ProductRating {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  buyer_name: string;
  product_name: string;
}

export function PublicSellerProfilePage({ sellerSlug, onBack, onProductClick }: PublicSellerProfilePageProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [ratings, setRatings] = useState<ProductRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'reviews'>('products');

  useEffect(() => {
    loadSellerData();
  }, [sellerSlug]);

  async function loadSellerData() {
    try {
      setLoading(true);
      setError(null);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('seller_slug', sellerSlug)
        .maybeSingle();

      if (profileError) {
        console.error('Error loading seller profile:', profileError);
        setError('Erro ao carregar perfil do vendedor');
        return;
      }

      if (!profileData) {
        setError('Vendedor não encontrado');
        return;
      }

      if (profileData.role !== 'seller' && profileData.role !== 'admin') {
        setError('Perfil não é de um vendedor');
        return;
      }

      setProfile(profileData);
      await loadSellerStats(profileData.id);
      await loadSellerProducts(profileData.id);
      await loadSellerRatings(profileData.id);
    } catch (error) {
      console.error('Error loading seller data:', error);
      setError('Erro ao carregar dados do vendedor');
    } finally {
      setLoading(false);
    }
  }

  async function loadSellerStats(sellerId: string) {
    try {
      const { count: totalSales, error: salesError } = await supabase
        .from('store_orders')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', sellerId)
        .eq('status', 'completed');

      if (salesError) console.error('Error loading sales:', salesError);

      const { count: activeProducts, error: productsError } = await supabase
        .from('store_products')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', sellerId)
        .eq('active', true);

      if (productsError) console.error('Error loading products count:', productsError);

      const { data: ratingsData, error: ratingsError } = await supabase
        .from('product_ratings')
        .select('rating, store_products!inner(seller_id)')
        .eq('store_products.seller_id', sellerId);

      if (ratingsError) console.error('Error loading ratings:', ratingsError);

      const avgRating = ratingsData && ratingsData.length > 0
        ? ratingsData.reduce((sum, r) => sum + r.rating, 0) / ratingsData.length
        : 0;

      const memberSince = profile?.created_at
        ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      setStats({
        total_sales: totalSales || 0,
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
        .select(`
          *,
          store_products!inner(name, seller_id),
          profiles!product_ratings_user_id_fkey(full_name)
        `)
        .eq('store_products.seller_id', sellerId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (ratingsWithDetails) {
        setRatings(ratingsWithDetails.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment || '',
          created_at: r.created_at,
          buyer_name: r.profiles?.full_name || 'Anonymous',
          product_name: r.store_products?.name || ''
        })));
      }
    } catch (error) {
      console.error('Error in loadSellerRatings:', error);
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  function getRoleLabel(role: string) {
    const labels: Record<string, string> = {
      admin: t.language === 'pt' ? 'Administrador' : t.language === 'en' ? 'Administrator' : 'Administrador',
      seller: t.language === 'pt' ? 'Vendedor' : t.language === 'en' ? 'Seller' : 'Vendedor',
      customer: t.language === 'pt' ? 'Cliente' : t.language === 'en' ? 'Customer' : 'Cliente',
    };
    return labels[role] || role;
  }

  const themeColor = profile?.theme_color || '#3b82f6';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="text-center py-16">
        <Package className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
        <p className="mt-3 text-gray-500 dark:text-gray-400">{error || 'Perfil não encontrado'}</p>
        <button
          onClick={onBack}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.language === 'pt' ? 'Voltar' : t.language === 'en' ? 'Back' : 'Volver'}
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'products' as const, label: t.language === 'pt' ? 'Produtos' : t.language === 'en' ? 'Products' : 'Productos', icon: Package, count: products.length },
    { id: 'reviews' as const, label: t.language === 'pt' ? 'Avaliações' : t.language === 'en' ? 'Reviews' : 'Reseñas', icon: Star, count: ratings.length },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-0">
      {/* Back button */}
      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.language === 'pt' ? 'Voltar para a loja' : t.language === 'en' ? 'Back to store' : 'Volver a la tienda'}
      </button>

      {/* Profile Card - matching UserProfile design */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Cover image area */}
        <div className="relative h-36 sm:h-48 group">
          {profile.cover_url ? (
            <img
              src={profile.cover_url}
              alt="Capa"
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(135deg, ${themeColor}33 0%, ${themeColor}88 50%, ${themeColor}55 100%)`,
              }}
            />
          )}
          {!profile.cover_url && (
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)`,
                backgroundSize: '40px 40px',
              }}
            />
          )}
        </div>

        {/* Avatar + name row */}
        <div className="px-6 pb-5">
          <div className="flex items-end justify-between -mt-10 mb-4">
            {/* Avatar */}
            <div className="relative group">
              <div
                className="w-20 h-20 rounded-2xl border-4 border-white dark:border-gray-800 shadow-lg overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}aa)` }}
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {profile.full_name?.charAt(0).toUpperCase() || <User className="h-8 w-8 text-white" />}
                    </span>
                  </div>
                )}
              </div>
              {/* Verified badge */}
              <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-white dark:border-gray-800">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            </div>

            {/* Chat button */}
            {user && user.id !== profile.id && (
              <button
                onClick={() => setChatOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                {t.language === 'pt' ? 'Enviar mensagem' : t.language === 'en' ? 'Send message' : 'Enviar mensaje'}
              </button>
            )}
          </div>

          {/* Name + badge */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {profile.full_name || 'Vendedor'}
              </h2>
              {profile.profile_badge && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: themeColor }}
                >
                  {profile.profile_badge}
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <Store className="w-3 h-3 inline mr-1" />
                {getRoleLabel(profile.role)}
              </span>
              {profile.seller_level != null && profile.seller_level > 1 && (
                <LevelBadge level={profile.seller_level} type="seller" size="xs" showLabel />
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Award className="h-3.5 w-3.5" />
              {t.language === 'pt' ? 'Vendedor Verificado' : t.language === 'en' ? 'Verified Seller' : 'Vendedor Verificado'}
            </p>
            {profile.bio && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic">"{profile.bio}"</p>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="px-6 pb-5 grid grid-cols-3 gap-3">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <ShoppingBag className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{stats?.total_sales || 0}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t.language === 'pt' ? 'Vendas' : t.language === 'en' ? 'Sales' : 'Ventas'}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <Package className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{stats?.active_products || 0}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t.language === 'pt' ? 'Produtos' : t.language === 'en' ? 'Products' : 'Productos'}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center mb-1">
              <Star className="w-4 h-4 text-yellow-500" />
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{stats?.average_rating.toFixed(1) || '0.0'}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t.language === 'pt' ? 'Avaliação' : t.language === 'en' ? 'Rating' : 'Calificación'}</div>
          </div>
        </div>

        {/* Online status + member since */}
        <div className="px-6 pb-5">
          <div className="flex items-center justify-center gap-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl py-2.5 text-xs text-gray-500 dark:text-gray-400">
            <OnlineBadge lastSeenAt={profile.last_seen_at} language={t.language} showLabel size="sm" />
            {stats && stats.member_since_days > 0 && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {t.language === 'pt' ? `Membro há ${stats.member_since_days} dias` : t.language === 'en' ? `Member for ${stats.member_since_days} days` : `Miembro por ${stats.member_since_days} días`}
              </span>
            )}
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {stats?.total_reviews || 0} {t.language === 'pt' ? 'avaliações' : t.language === 'en' ? 'reviews' : 'reseñas'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-gray-700">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              style={activeTab === tab.id ? { borderBottomColor: themeColor, color: themeColor } : {}}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'products' && (
            <div>
              {products.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {t.language === 'pt' ? 'Nenhum produto disponível' : t.language === 'en' ? 'No products available' : 'No hay productos disponibles'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => onProductClick?.(product)}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all cursor-pointer group"
                    >
                      <div className="aspect-video bg-gray-200 dark:bg-gray-600 overflow-hidden">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700">
                            <Package className="h-16 w-16 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {product.name}
                        </h3>
                        {product.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                            {product.description}
                          </p>
                        )}
                        <div className="mt-3">
                          <ProductRatingsDisplay productId={product.id} showTitle={false} compact={true} />
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-xl font-bold text-green-600 dark:text-green-400">
                            ${product.price_usdt.toFixed(2)}
                          </span>
                          <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                            (product.manual_delivery || product.stock_quantity > 0)
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          }`}>
                            {(product.manual_delivery || product.stock_quantity > 0)
                              ? (t.language === 'pt' ? 'Disponível' : t.language === 'en' ? 'Available' : 'Disponible')
                              : (t.language === 'pt' ? 'Esgotado' : t.language === 'en' ? 'Out of Stock' : 'Agotado')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div>
              {ratings.length === 0 ? (
                <div className="text-center py-12">
                  <Star className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {t.language === 'pt' ? 'Nenhuma avaliação ainda' : t.language === 'en' ? 'No reviews yet' : 'Sin reseñas todavía'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {ratings.map((rating) => (
                    <div
                      key={rating.id}
                      className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {rating.buyer_name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(rating.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {rating.product_name}
                          </p>
                        </div>
                        <div className="flex items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < rating.rating
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-gray-300 dark:text-gray-600'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {rating.comment && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                          {rating.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {chatOpen && (
        <ChatModal
          otherUserId={profile.id}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
