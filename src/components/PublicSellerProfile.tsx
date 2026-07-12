import React, { useState, useEffect } from 'react';
import {
  X, Star, Package, ShoppingBag, TrendingUp,
  Award, CheckCircle, User, MessageCircle, Calendar, Shield
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';
import { ProductRatingsDisplay } from './ProductRatingsDisplay';
import { OnlineBadge } from './OnlineBadge';
import { ChatModal } from './ChatModal';

interface PublicSellerProfileProps {
  sellerId: string | null;
  onClose: () => void;
  onProductClick?: (product: SellerProduct) => void;
}

interface SellerProfile {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  cover_url?: string | null;
  bio?: string | null;
  theme_color?: string | null;
  profile_badge?: string | null;
  created_at: string;
  role: string;
  last_seen_at?: string | null;
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

export function PublicSellerProfile({ sellerId, onClose, onProductClick }: PublicSellerProfileProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [ratings, setRatings] = useState<ProductRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'reviews'>('products');
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    loadSellerData();
  }, [sellerId]);

  async function loadSellerData() {
    try {
      setLoading(true);
      setError(null);

      if (!sellerId) {
        const { data: adminData } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'admin')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (adminData) {
          setProfile({ ...adminData, full_name: adminData.full_name || 'Admin' });
          await loadAdminStats(adminData.id);
        } else {
          setError('Perfil não encontrado');
        }
      } else {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sellerId)
          .maybeSingle();
        if (profileError) { setError('Erro ao carregar perfil'); return; }
        if (profileData) {
          setProfile(profileData);
          await loadSellerStats(sellerId);
          await loadSellerProducts(sellerId);
          await loadSellerRatings(sellerId);
        } else {
          setError('Perfil não encontrado');
        }
      }
    } catch {
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function loadAdminStats(adminId: string) {
    try {
      const { count: totalSales } = await supabase
        .from('store_orders')
        .select('*', { count: 'exact', head: true })
        .is('seller_id', null)
        .in('status', ['delivered', 'paid', 'processing']);
      const { count: activeProducts } = await supabase
        .from('store_products')
        .select('*', { count: 'exact', head: true })
        .eq('active', true);
      const { data: ratingsData } = await supabase
        .from('product_ratings')
        .select('rating');
      const avgRating = ratingsData && ratingsData.length > 0
        ? ratingsData.reduce((s: number, r: any) => s + r.rating, 0) / ratingsData.length : 0;

      const { data: adminProfile } = await supabase
        .from('profiles').select('created_at').eq('id', adminId).maybeSingle();
      const memberDays = adminProfile?.created_at
        ? Math.floor((Date.now() - new Date(adminProfile.created_at).getTime()) / 86400000) : 0;

      setStats({ total_sales: totalSales || 0, active_products: activeProducts || 0, average_rating: avgRating, total_reviews: ratingsData?.length || 0, member_since_days: memberDays });

      // Load all admin products and ratings
      const { data: prods } = await supabase
        .from('store_products').select('*').eq('active', true)
        .order('created_at', { ascending: false });
      setProducts(prods || []);

      const { data: revs } = await supabase
        .from('product_ratings')
        .select('*, store_products!inner(name), profiles!product_ratings_user_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(20);
      if (revs) {
        setRatings(revs.map((r: any) => ({
          id: r.id, rating: r.rating, comment: r.comment || '',
          created_at: r.created_at,
          buyer_name: r.profiles?.full_name || 'Anônimo',
          product_name: r.store_products?.name || '',
        })));
      }
    } catch { /* ignore */ }
  }

  async function loadSellerStats(id: string) {
    try {
      const { count: totalSales } = await supabase
        .from('store_orders').select('*', { count: 'exact', head: true })
        .eq('seller_id', id).in('status', ['delivered', 'paid', 'processing']);
      const { count: activeProducts } = await supabase
        .from('store_products').select('*', { count: 'exact', head: true })
        .eq('seller_id', id).eq('active', true);
      const { data: ratingsData } = await supabase
        .from('product_ratings').select('rating, store_products!inner(seller_id)')
        .eq('store_products.seller_id', id);
      const avgRating = ratingsData && ratingsData.length > 0
        ? ratingsData.reduce((s: number, r: any) => s + r.rating, 0) / ratingsData.length : 0;
      const memberDays = profile?.created_at
        ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000) : 0;
      setStats({ total_sales: totalSales || 0, active_products: activeProducts || 0, average_rating: avgRating, total_reviews: ratingsData?.length || 0, member_since_days: memberDays });
    } catch { /* ignore */ }
  }

  async function loadSellerProducts(id: string) {
    try {
      const { data } = await supabase
        .from('store_products').select('*')
        .eq('seller_id', id).eq('active', true)
        .order('created_at', { ascending: false });
      setProducts(data || []);
    } catch { /* ignore */ }
  }

  async function loadSellerRatings(id: string) {
    try {
      const { data } = await supabase
        .from('product_ratings')
        .select('*, store_products!inner(name, seller_id), profiles!product_ratings_user_id_fkey(full_name)')
        .eq('store_products.seller_id', id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) {
        setRatings(data.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment || '',
          created_at: r.created_at,
          buyer_name: r.profiles?.full_name || 'Anônimo',
          product_name: r.store_products?.name || '',
        })));
      }
    } catch { /* ignore */ }
  }

  const themeColor = profile?.theme_color || '#3b82f6';
  const lbl = (pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative min-h-screen flex items-start justify-center py-6 px-4">
        <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-20 p-1.5 rounded-xl bg-black/30 hover:bg-black/50 text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Cover */}
          <div className="relative h-36 sm:h-44">
            {profile?.cover_url ? (
              <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full"
                style={{ background: `linear-gradient(135deg, ${themeColor}55 0%, ${themeColor}cc 60%, ${themeColor}88 100%)` }}
              />
            )}
            {/* Pattern overlay */}
            {!profile?.cover_url && (
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
                  backgroundSize: '28px 28px',
                }}
              />
            )}
            {/* Avatar anchored to bottom of cover */}
            <div className="absolute -bottom-10 left-6 z-10">
              <div
                className="w-20 h-20 rounded-2xl border-4 border-white dark:border-gray-900 shadow-lg overflow-hidden flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}88)` }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-white" />
                )}
              </div>
            </div>
          </div>

          {/* Header info — padded to clear the protruding avatar */}
          <div className="px-6 pb-4 pt-12">
            <div className="flex items-center justify-between mb-3">
              {/* spacer so chat button doesn't overlap avatar area */}
              <div />

              {/* Chat button */}
              {user && profile && user.id !== profile.id && (
                <button
                  onClick={() => setChatOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl transition-colors shrink-0"
                  style={{ backgroundColor: themeColor }}
                >
                  <MessageCircle className="h-4 w-4" />
                  {lbl('Mensagem', 'Message', 'Mensaje')}
                </button>
              )}
            </div>

            {/* Name + badge + role */}
            <div className="space-y-1">
              {loading ? (
                <div className="h-7 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              ) : (
                <div className="flex items-center flex-wrap gap-2">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {profile?.full_name || 'Usuário'}
                  </h2>
                  {profile?.profile_badge && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: themeColor }}
                    >
                      {profile.profile_badge}
                    </span>
                  )}
                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    profile?.role === 'admin'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  }`}>
                    {profile?.role === 'admin'
                      ? <><Shield className="w-3 h-3" /> Admin</>
                      : <><Award className="w-3 h-3" /> {lbl('Vendedor', 'Seller', 'Vendedor')}</>
                    }
                  </span>
                </div>
              )}

              {/* Online status */}
              {profile && (
                <OnlineBadge
                  lastSeenAt={profile.last_seen_at}
                  language={language}
                  showLabel
                  size="sm"
                />
              )}

              {/* Bio */}
              {profile?.bio && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic mt-1">
                  "{profile.bio}"
                </p>
              )}

              {/* Member since */}
              {profile?.created_at && (
                <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mt-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {lbl('Membro desde', 'Member since', 'Miembro desde')} {new Date(profile.created_at).toLocaleDateString(language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'es-ES', { month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>

          {/* Stats strip */}
          {stats && (
            <div className="mx-6 mb-4 grid grid-cols-4 gap-2">
              {[
                { icon: ShoppingBag, value: stats.total_sales, label: lbl('Vendas', 'Sales', 'Ventas'), color: 'text-blue-500' },
                { icon: Package, value: stats.active_products, label: lbl('Produtos', 'Products', 'Productos'), color: 'text-emerald-500' },
                { icon: Star, value: stats.average_rating.toFixed(1), label: lbl('Nota', 'Rating', 'Nota'), color: 'text-amber-500' },
                { icon: TrendingUp, value: stats.total_reviews, label: lbl('Avaliações', 'Reviews', 'Reseñas'), color: 'text-rose-500' },
              ].map((s, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                  <s.icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
                  <div className="text-base font-bold text-gray-900 dark:text-white leading-tight">{s.value}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="border-t border-gray-100 dark:border-gray-800">
            <div className="flex px-6">
              {(['products', 'reviews'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-current'
                      : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                  style={activeTab === tab ? { color: themeColor, borderColor: themeColor } : {}}
                >
                  {tab === 'products'
                    ? `${lbl('Produtos', 'Products', 'Productos')} (${products.length})`
                    : `${lbl('Avaliações', 'Reviews', 'Reseñas')} (${ratings.length})`}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="p-6 max-h-[50vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: themeColor }} />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-500 text-sm">{error}</p>
              </div>
            ) : activeTab === 'products' ? (
              products.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {lbl('Nenhum produto disponível', 'No products available', 'No hay productos')}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {products.map(product => (
                    <div
                      key={product.id}
                      onClick={() => { onProductClick?.(product); onClose(); }}
                      className="bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="aspect-video bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${themeColor}55, ${themeColor}aa)` }}>
                            <Package className="h-10 w-10 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1">{product.name}</h3>
                        {product.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{product.description}</p>
                        )}
                        <div className="mt-2">
                          <ProductRatingsDisplay productId={product.id} showTitle={false} compact />
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">${product.price_usdt.toFixed(2)}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            (product.manual_delivery || product.stock_quantity > 0)
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                          }`}>
                            {(product.manual_delivery || product.stock_quantity > 0)
                              ? lbl('Disponível', 'Available', 'Disponible')
                              : lbl('Esgotado', 'Out of Stock', 'Agotado')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              ratings.length === 0 ? (
                <div className="text-center py-12">
                  <Star className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {lbl('Nenhuma avaliação ainda', 'No reviews yet', 'Sin reseñas')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {ratings.map(rating => (
                    <div key={rating.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{rating.buyer_name}</span>
                          <p className="text-xs text-gray-400 mt-0.5">{rating.product_name}</p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < rating.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
                          ))}
                        </div>
                      </div>
                      {rating.comment && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{rating.comment}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-2">{new Date(rating.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Chat modal */}
      {chatOpen && profile && (
        <ChatModal
          otherUserId={profile.id}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
