import React, { useState, useEffect } from 'react';
import { X, Star, Package, Calendar, ShoppingBag, TrendingUp, Award, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { ProductRatingsDisplay } from './ProductRatingsDisplay';

interface PublicSellerProfileProps {
  sellerId: string | null;
  onClose: () => void;
  onProductClick?: (product: SellerProduct) => void;
}

interface SellerProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  role: string;
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
  const { t } = useLanguage();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [ratings, setRatings] = useState<ProductRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'products' | 'reviews'>('products');

  useEffect(() => {
    loadSellerData();
  }, [sellerId]);

  async function loadSellerData() {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading seller data for:', sellerId);

      if (!sellerId) {
        console.log('Loading admin profile');
        const { data: adminData, error: adminError } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'admin')
          .maybeSingle();

        if (adminError) {
          console.error('Error loading admin profile:', adminError);
          setError('Erro ao carregar perfil do admin');
          return;
        }

        if (adminData) {
          setProfile({
            ...adminData,
            full_name: adminData.full_name || 'Admin'
          });
          await loadAdminStats();
        } else {
          setError('Perfil do admin não encontrado');
        }
      } else {
        console.log('Loading seller profile:', sellerId);
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sellerId)
          .maybeSingle();

        if (profileError) {
          console.error('Error loading seller profile:', profileError);
          setError('Erro ao carregar perfil do vendedor');
          return;
        }

        if (profileData) {
          console.log('Profile loaded:', profileData);
          setProfile(profileData);
          await loadSellerStats(sellerId);
          await loadSellerProducts(sellerId);
          await loadSellerRatings(sellerId);
        } else {
          console.error('No profile data found');
          setError('Perfil não encontrado');
        }
      }
    } catch (error) {
      console.error('Error loading seller data:', error);
      setError('Erro ao carregar dados do vendedor');
    } finally {
      setLoading(false);
    }
  }

  async function loadAdminStats() {
    try {
      console.log('Loading admin stats...');

      const { count: totalSales, error: salesError } = await supabase
        .from('store_orders')
        .select('*', { count: 'exact', head: true })
        .is('seller_id', null)
        .eq('status', 'completed');

      if (salesError) {
        console.error('Error loading admin sales:', salesError);
      }

      const { count: activeProducts, error: productsError } = await supabase
        .from('store_products')
        .select('*', { count: 'exact', head: true })
        .is('seller_id', null)
        .eq('active', true);

      if (productsError) {
        console.error('Error loading admin products count:', productsError);
      }

      const { data: ratingsData, error: ratingsError } = await supabase
        .from('product_ratings')
        .select('rating, store_products!inner(seller_id)')
        .is('store_products.seller_id', null);

      if (ratingsError) {
        console.error('Error loading admin ratings:', ratingsError);
      }

      const avgRating = ratingsData && ratingsData.length > 0
        ? ratingsData.reduce((sum, r) => sum + r.rating, 0) / ratingsData.length
        : 0;

      const statsData = {
        total_sales: totalSales || 0,
        active_products: activeProducts || 0,
        average_rating: avgRating,
        total_reviews: ratingsData?.length || 0,
        member_since_days: 0
      };

      console.log('Admin stats loaded:', statsData);
      setStats(statsData);

      const { data: productsData, error: productsListError } = await supabase
        .from('store_products')
        .select('*')
        .is('seller_id', null)
        .eq('active', true)
        .limit(6);

      if (productsListError) {
        console.error('Error loading admin products:', productsListError);
      } else {
        console.log('Admin products loaded:', productsData?.length || 0);
        setProducts(productsData || []);
      }

      const { data: ratingsWithDetails, error: ratingsDetailsError } = await supabase
        .from('product_ratings')
        .select(`
          *,
          store_products!inner(name, seller_id),
          profiles!product_ratings_user_id_fkey(full_name)
        `)
        .is('store_products.seller_id', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (ratingsDetailsError) {
        console.error('Error loading admin ratings details:', ratingsDetailsError);
      } else if (ratingsWithDetails) {
        console.log('Admin ratings loaded:', ratingsWithDetails.length);
        setRatings(ratingsWithDetails.map(r => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment || '',
          created_at: r.created_at,
          buyer_name: r.profiles?.full_name || 'Anonymous',
          product_name: r.store_products?.name || ''
        })));
      }
    } catch (error) {
      console.error('Error in loadAdminStats:', error);
    }
  }

  async function loadSellerStats(sellerId: string) {
    try {
      console.log('Loading seller stats for:', sellerId);

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

      const statsData = {
        total_sales: totalSales || 0,
        active_products: activeProducts || 0,
        average_rating: avgRating,
        total_reviews: ratingsData?.length || 0,
        member_since_days: memberSince
      };

      console.log('Stats loaded:', statsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error in loadSellerStats:', error);
    }
  }

  async function loadSellerProducts(sellerId: string) {
    try {
      console.log('Loading seller products for:', sellerId);

      const { data, error } = await supabase
        .from('store_products')
        .select('*')
        .eq('seller_id', sellerId)
        .eq('active', true)
        .limit(6);

      if (error) {
        console.error('Error loading products:', error);
        throw error;
      }

      console.log('Products loaded:', data?.length || 0);
      setProducts(data || []);
    } catch (error) {
      console.error('Error in loadSellerProducts:', error);
    }
  }

  async function loadSellerRatings(sellerId: string) {
    try {
      console.log('Loading seller ratings for:', sellerId);

      const { data: ratingsWithDetails, error } = await supabase
        .from('product_ratings')
        .select(`
          *,
          store_products!inner(name, seller_id),
          profiles!product_ratings_user_id_fkey(full_name)
        `)
        .eq('store_products.seller_id', sellerId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error loading ratings:', error);
        throw error;
      }

      if (ratingsWithDetails) {
        console.log('Ratings loaded:', ratingsWithDetails.length);
        setRatings(ratingsWithDetails.map(r => ({
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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 min-w-[300px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-center mt-4 text-gray-600 dark:text-gray-400">
            {t.language === 'pt' ? 'Carregando...' : t.language === 'en' ? 'Loading...' : 'Cargando...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t.language === 'pt' ? 'Erro ao Carregar' : t.language === 'en' ? 'Loading Error' : 'Error al Cargar'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t.language === 'pt' ? 'Fechar' : t.language === 'en' ? 'Close' : 'Cerrar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t.language === 'pt' ? 'Perfil do Vendedor' : t.language === 'en' ? 'Seller Profile' : 'Perfil del Vendedor'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name}
                      className="w-20 h-20 rounded-full border-4 border-white object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full border-4 border-white bg-white/20 flex items-center justify-center">
                      <span className="text-3xl font-bold">
                        {profile.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold">{profile.full_name}</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <Award className="w-4 h-4" />
                    <span className="text-sm opacity-90">
                      {t.language === 'pt' ? 'Vendedor Verificado' : t.language === 'en' ? 'Verified Seller' : 'Vendedor Verificado'}
                    </span>
                  </div>
                  {stats && stats.member_since_days > 0 && (
                    <div className="flex items-center space-x-2 mt-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm opacity-90">
                        {t.language === 'pt'
                          ? `Membro há ${stats.member_since_days} dias`
                          : t.language === 'en'
                          ? `Member for ${stats.member_since_days} days`
                          : `Miembro por ${stats.member_since_days} días`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                <div className="flex items-center justify-between mb-2">
                  <ShoppingBag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.total_sales}
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  {t.language === 'pt' ? 'Vendas' : t.language === 'en' ? 'Sales' : 'Ventas'}
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
                <div className="flex items-center justify-between mb-2">
                  <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.active_products}
                </div>
                <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                  {t.language === 'pt' ? 'Produtos' : t.language === 'en' ? 'Products' : 'Productos'}
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700">
                <div className="flex items-center justify-between mb-2">
                  <Star className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {stats.average_rating.toFixed(1)}
                </div>
                <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  {t.language === 'pt' ? 'Avaliação' : t.language === 'en' ? 'Rating' : 'Calificación'}
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.total_reviews}
                </div>
                <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                  {t.language === 'pt' ? 'Avaliações' : t.language === 'en' ? 'Reviews' : 'Reseñas'}
                </div>
              </div>
            </div>
          )}

          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab('products')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'products'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {t.language === 'pt' ? 'Produtos' : t.language === 'en' ? 'Products' : 'Productos'} ({products.length})
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                  activeTab === 'reviews'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {t.language === 'pt' ? 'Avaliações' : t.language === 'en' ? 'Reviews' : 'Reseñas'} ({ratings.length})
              </button>
            </div>
          </div>

          {activeTab === 'products' && (
            <div>
              {products.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {t.language === 'pt' ? 'Nenhum produto disponível' : t.language === 'en' ? 'No products available' : 'No hay productos disponibles'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => onProductClick?.(product)}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all cursor-pointer transform hover:scale-105"
                    >
                      <div className="aspect-video bg-gray-200 dark:bg-gray-600">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                            <Package className="h-12 w-12 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-1">
                          {product.name}
                        </h4>
                        {product.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                            {product.description}
                          </p>
                        )}
                        <div className="mt-3">
                          <ProductRatingsDisplay productId={product.id} showTitle={false} compact={true} />
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-lg font-bold text-green-600 dark:text-green-400">
                            ${product.price_usdt.toFixed(2)}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
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
                  <Star className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {t.language === 'pt' ? 'Nenhuma avaliação ainda' : t.language === 'en' ? 'No reviews yet' : 'Sin reseñas todavía'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {ratings.map((rating) => (
                    <div
                      key={rating.id}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
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
    </div>
  );
}
