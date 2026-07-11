import React, { useState, useEffect } from 'react';
import { Star, MessageCircle, Calendar, User, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface RecentRating {
  rating_id: string;
  product_id: string;
  product_name: string;
  user_name: string;
  user_email: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface RecentRatingsProps {
  limit?: number;
  showTitle?: boolean;
}

export function RecentRatings({ limit = 10, showTitle = true }: RecentRatingsProps) {
  const { t } = useLanguage();
  const [recentRatings, setRecentRatings] = useState<RecentRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentRatings();
  }, [limit]);

  async function loadRecentRatings() {
    try {
      const { data, error } = await supabase
        .from('product_ratings')
        .select(`
          id,
          user_id,
          product_id,
          rating,
          comment,
          created_at,
          store_products (
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

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
        } else {
          // Transform the data to match the expected interface
          const transformedData = data.map(item => {
            const profile = profiles?.find(p => p.id === rating.user_id);
            return {
              rating_id: item.id,
              product_id: item.product_id,
              product_name: item.store_products?.name || 'Unknown Product',
              user_name: profile?.full_name || profile?.email?.split('@')[0] || 'Usuário Anônimo',
              user_email: profile?.email || '',
              rating: item.rating,
              comment: item.comment || '',
              created_at: item.created_at
            };
          });
          setRecentRatings(transformedData);
          return;
        }
      }
      
      // Fallback if no data or profiles failed to load
      const fallbackData = (data || []).map(item => ({
        rating_id: item.id,
        product_id: item.product_id,
        product_name: item.store_products?.name || 'Unknown Product',
        user_name: 'Usuário Anônimo',
        user_email: '',
        rating: item.rating,
        comment: item.comment || '',
        created_at: item.created_at
      }));
      setRecentRatings(fallbackData);
    } catch (error) {
      console.error('Error loading recent ratings:', error);
    } finally {
      setLoading(false);
    }
  }

  function renderStars(rating: number) {
    return (
      <div className="flex items-center space-x-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${
              i < rating
                ? 'text-yellow-500 fill-current'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
      </div>
    );
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(
      t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: limit }, (_, i) => (
          <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        ))}
      </div>
    );
  }

  if (recentRatings.length === 0) {
    return (
      <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <MessageCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t.language === 'pt' ? 'Nenhuma avaliação recente' :
           t.language === 'en' ? 'No recent ratings' :
           'No hay calificaciones recientes'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showTitle && (
        <div className="flex items-center space-x-2">
          <MessageCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t.language === 'pt' ? 'Avaliações Recentes' :
             t.language === 'en' ? 'Recent Reviews' :
             'Reseñas Recientes'}
          </h3>
        </div>
      )}

      <div className="space-y-3">
        {recentRatings.map((rating) => (
          <div key={rating.rating_id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                    {rating.user_name}
                  </h5>
                  <div className="flex items-center space-x-2 mt-1">
                    {renderStars(rating.rating)}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(rating.created_at)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                <Package className="h-3 w-3" />
                <span className="truncate max-w-32">{rating.product_name}</span>
              </div>
            </div>

            {rating.comment && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  "{rating.comment}"
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}