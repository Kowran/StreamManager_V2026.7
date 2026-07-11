import React, { useState, useEffect } from 'react';
import { Star, User, Calendar, MessageCircle, TrendingUp, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface ProductRating {
  id: string;
  user_id: string;
  product_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  profiles?: {
    full_name?: string;
    email: string;
  };
}

interface RatingSummary {
  average_rating: number;
  total_ratings: number;
  five_star_count: number;
  four_star_count: number;
  three_star_count: number;
  two_star_count: number;
  one_star_count: number;
}

interface ProductRatingsDisplayProps {
  productId: string;
  showTitle?: boolean;
  compact?: boolean;
}

export function ProductRatingsDisplay({ productId, showTitle = true, compact = false }: ProductRatingsDisplayProps) {
  const { t } = useLanguage();
  const [ratings, setRatings] = useState<ProductRating[]>([]);
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllRatings, setShowAllRatings] = useState(false);

  useEffect(() => {
    if (productId) {
      loadRatings();
      loadSummary();
    }
  }, [productId]);

  async function loadRatings() {
    try {
      const { data, error } = await supabase
        .from('product_ratings')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(showAllRatings ? 100 : 5);

      if (error) throw error;
      
      // Get user profiles separately
      if (data && data.length > 0) {
        const userIds = data.map(rating => rating.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        if (profilesError) {
          console.error('Error loading profiles:', profilesError);
          // Still show ratings even if profiles fail to load
          setRatings(data.map(rating => ({ ...rating, profiles: null })));
        } else {
          // Merge ratings with profiles
          const ratingsWithProfiles = data.map(rating => {
            const profile = profiles?.find(p => p.id === rating.user_id);
            return { ...rating, profiles: profile || null };
          });
          setRatings(ratingsWithProfiles);
        }
      } else {
        setRatings([]);
      }
    } catch (error) {
      console.error('Error loading ratings:', error);
    }
  }

  async function loadSummary() {
    try {
      const { data, error } = await supabase
        .from('product_rating_summary')
        .select('*')
        .eq('id', productId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setSummary(data);
    } catch (error) {
      console.error('Error loading rating summary:', error);
    } finally {
      setLoading(false);
    }
  }

  function renderStars(rating: number, size: 'sm' | 'md' | 'lg' = 'md') {
    const sizeClasses = {
      sm: 'h-3 w-3',
      md: 'h-4 w-4',
      lg: 'h-5 w-5'
    };

    return (
      <div className="flex items-center space-x-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`${sizeClasses[size]} ${
              i < rating
                ? 'text-yellow-500 fill-current'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
      </div>
    );
  }

  function getStarPercentage(starCount: number, total: number): number {
    return total > 0 ? (starCount / total) * 100 : 0;
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(
      t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
    );
  }

  function getUserDisplayName(rating: ProductRating): string {
    if (rating.profiles?.full_name) {
      return rating.profiles.full_name;
    }
    return rating.profiles?.email?.split('@')[0] || 'Usuário';
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (!summary || summary.total_ratings === 0) {
    if (compact) {
      return (
        <div className="flex items-center space-x-2">
          {renderStars(0, 'sm')}
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            0.0
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            (0)
          </span>
        </div>
      );
    }
    
    return (
      <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <Star className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t.language === 'pt' ? 'Nenhuma avaliação ainda' :
           t.language === 'en' ? 'No ratings yet' :
           'Aún no hay calificaciones'}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {t.language === 'pt' ? 'Seja o primeiro a avaliar este produto' :
           t.language === 'en' ? 'Be the first to rate this product' :
           'Sé el primero en calificar este producto'}
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        {renderStars(Math.round(summary.average_rating), 'sm')}
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {summary.average_rating.toFixed(1)}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          ({summary.total_ratings})
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showTitle && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t.language === 'pt' ? 'Avaliações dos Clientes' :
           t.language === 'en' ? 'Customer Reviews' :
           'Reseñas de Clientes'}
        </h3>
      )}

      {/* Rating Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Overall Rating */}
          <div className="text-center lg:text-left">
            <div className="flex flex-col lg:flex-row items-center lg:items-start space-y-2 lg:space-y-0 lg:space-x-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {summary.average_rating.toFixed(1)}
                </div>
                <div className="flex items-center justify-center mt-1">
                  {renderStars(Math.round(summary.average_rating), 'lg')}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {summary.total_ratings} {t.language === 'pt' ? 'avaliações' :
                                           t.language === 'en' ? 'reviews' :
                                           'reseñas'}
                </p>
              </div>
              
              <div className="flex-1 w-full lg:w-auto">
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = summary[`${['', 'one', 'two', 'three', 'four', 'five'][stars]}_star_count` as keyof RatingSummary] as number;
                    const percentage = getStarPercentage(count, summary.total_ratings);
                    
                    return (
                      <div key={stars} className="flex items-center space-x-2 text-sm">
                        <span className="text-gray-600 dark:text-gray-400 w-8">
                          {stars}★
                        </span>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                          <div
                            className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-gray-600 dark:text-gray-400 w-8 text-right">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Rating Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <Award className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                {Math.round(getStarPercentage(summary.five_star_count + summary.four_star_count, summary.total_ratings))}%
              </div>
              <p className="text-xs text-green-700 dark:text-green-500">
                {t.language === 'pt' ? 'Satisfação' : t.language === 'en' ? 'Satisfaction' : 'Satisfacción'}
              </p>
            </div>

            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {summary.total_ratings}
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-500">
                {t.language === 'pt' ? 'Total' : t.language === 'en' ? 'Total' : 'Total'}
              </p>
            </div>

            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                {summary.five_star_count}
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-500">
                {t.language === 'pt' ? '5 Estrelas' : t.language === 'en' ? '5 Stars' : '5 Estrellas'}
              </p>
            </div>

            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="flex items-center justify-center mb-2">
                <MessageCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {ratings.filter(r => r.comment && r.comment.trim()).length}
              </div>
              <p className="text-xs text-purple-700 dark:text-purple-500">
                {t.language === 'pt' ? 'Comentários' : t.language === 'en' ? 'Comments' : 'Comentarios'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Ratings */}
      {ratings.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-medium text-gray-900 dark:text-white">
              {t.language === 'pt' ? 'Avaliações Recentes' :
               t.language === 'en' ? 'Recent Reviews' :
               'Reseñas Recientes'}
            </h4>
            {ratings.length > 5 && !showAllRatings && (
              <button
                onClick={() => {
                  setShowAllRatings(true);
                  loadRatings();
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              >
                {t.language === 'pt' ? 'Ver todas' : t.language === 'en' ? 'View all' : 'Ver todas'}
              </button>
            )}
          </div>

          <div className="space-y-4">
            {ratings.map((rating) => (
              <div key={rating.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                        {getUserDisplayName(rating)}
                      </h5>
                      <div className="flex items-center space-x-2 mt-1">
                        {renderStars(rating.rating, 'sm')}
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(rating.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(rating.created_at)}
                    </span>
                  </div>
                </div>

                {rating.comment && (
                  <div className="bg-white dark:bg-gray-800 rounded-md p-3 border border-gray-200 dark:border-gray-600">
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      "{rating.comment}"
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {showAllRatings && ratings.length > 5 && (
            <div className="text-center">
              <button
                onClick={() => {
                  setShowAllRatings(false);
                  loadRatings();
                }}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
              >
                {t.language === 'pt' ? 'Mostrar menos' : t.language === 'en' ? 'Show less' : 'Mostrar menos'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}