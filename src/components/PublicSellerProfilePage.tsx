import React, { useState, useEffect } from 'react';
import { Star, Package, Calendar, ShoppingBag, TrendingUp, Award, CheckCircle, ArrowLeft, Mail, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { ProductRatingsDisplay } from './ProductRatingsDisplay';

interface PublicSellerProfilePageProps {
  sellerSlug: string;
  onBack: () => void;
  onProductClick?: (product: SellerProduct) => void;
}

interface SellerProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  role: string;
  seller_slug: string;
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
  const [profile, setProfile] = useState<SellerProfile | null>(null);
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

      const statsData = {
        total_sales: totalSales || 0,
        active_products: activeProducts || 0,
        average_rating: avgRating,
        total_reviews: ratingsData?.length || 0,
        member_since_days: memberSince
      };

      setStats(statsData);
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

      if (error) {
        console.error('Error loading products:', error);
        throw error;
      }

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

      if (error) {
        console.error('Error loading ratings:', error);
        throw error;
      }

      if (ratingsWithDetails) {
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-center mt-4 text-gray-600 dark:text-gray-400">
            {t.language === 'pt' ? 'Carregando perfil...' : t.language === 'en' ? 'Loading profile...' : 'Cargando perfil...'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {error || 'Perfil não encontrado'}
            </h3>
            <button
              onClick={onBack}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t.language === 'pt' ? 'Voltar' : t.language === 'en' ? 'Back' : 'Volver'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={onBack}
          className="mb-6 inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          {t.language === 'pt' ? 'Voltar para a loja' : t.language === 'en' ? 'Back to store' : 'Volver a la tienda'}
        </button>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-8 text-white">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="relative">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="w-24 h-24 rounded-full border-4 border-white object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full border-4 border-white bg-white/20 flex items-center justify-center">
                    <span className="text-4xl font-bold">
                      {profile.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              </div>

              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{profile.full_name}</h1>
                <div className="flex flex-wrap items-center gap-4 text-sm opacity-90">
                  <div className="flex items-center">
                    <Award className="w-4 h-4 mr-1" />
                    <span>{t.language === 'pt' ? 'Vendedor Verificado' : t.language === 'en' ? 'Verified Seller' : 'Vendedor Verificado'}</span>
                  </div>
                  {stats && stats.member_since_days > 0 && (
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      <span>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <ShoppingBag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.total_sales}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {t.language === 'pt' ? 'Vendas' : t.language === 'en' ? 'Sales' : 'Ventas'}
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.active_products}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {t.language === 'pt' ? 'Produtos' : t.language === 'en' ? 'Products' : 'Productos'}
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <Star className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.average_rating.toFixed(1)}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {t.language === 'pt' ? 'Avaliação' : t.language === 'en' ? 'Rating' : 'Calificación'}
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.total_reviews}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {t.language === 'pt' ? 'Avaliações' : t.language === 'en' ? 'Reviews' : 'Reseñas'}
                </div>
              </div>
            </div>
          )}

          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('products')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'products'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {t.language === 'pt' ? 'Produtos' : t.language === 'en' ? 'Products' : 'Productos'} ({products.length})
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'reviews'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {t.language === 'pt' ? 'Avaliações' : t.language === 'en' ? 'Reviews' : 'Reseñas'} ({ratings.length})
              </button>
            </div>
          </div>

          <div className="p-6">
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
      </div>
    </div>
  );
}
