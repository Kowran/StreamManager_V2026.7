import React, { useState, useEffect, useCallback } from 'react';
import { Loader, Star } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { supabase } from '../lib/supabase';

interface SellerReputationProps {
  sellerId: string;
  sellerName?: string;
}

interface UnifiedRating {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

type ReputationTier = 'pessimo' | 'ruim' | 'medio' | 'bom' | 'muito_bom';

const TIER_CONFIG: Record<ReputationTier, { color: string; bgColor: string; textColor: string; label: { pt: string; en: string; es: string } }> = {
  pessimo: { color: '#dc2626', bgColor: 'bg-red-100 dark:bg-red-900/30', textColor: 'text-red-700 dark:text-red-400', label: { pt: 'Péssimo', en: 'Terrible', es: 'Pésimo' } },
  ruim: { color: '#f87171', bgColor: 'bg-red-50 dark:bg-red-900/20', textColor: 'text-red-500 dark:text-red-300', label: { pt: 'Ruim', en: 'Poor', es: 'Malo' } },
  medio: { color: '#eab308', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', textColor: 'text-yellow-700 dark:text-yellow-400', label: { pt: 'Médio', en: 'Average', es: 'Medio' } },
  bom: { color: '#4ade80', bgColor: 'bg-green-50 dark:bg-green-900/20', textColor: 'text-green-600 dark:text-green-400', label: { pt: 'Bom', en: 'Good', es: 'Bueno' } },
  muito_bom: { color: '#16a34a', bgColor: 'bg-green-100 dark:bg-green-900/30', textColor: 'text-green-700 dark:text-green-500', label: { pt: 'Muito Bom', en: 'Very Good', es: 'Muy Bueno' } },
};

function getTierFromRating(avg: number): ReputationTier {
  if (avg <= 1) return 'pessimo';
  if (avg <= 2) return 'ruim';
  if (avg <= 3) return 'medio';
  if (avg <= 4) return 'bom';
  return 'muito_bom';
}

export function SellerReputation({ sellerId, sellerName }: SellerReputationProps) {
  const { language } = useLanguage();
  const [ratings, setRatings] = useState<UnifiedRating[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAllComments, setShowAllComments] = useState(false);

  const tr = (pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es;

  const loadRatings = useCallback(async () => {
    setLoading(true);
    try {
      const [userRatingsResult, productRatingsResult] = await Promise.all([
        supabase
          .from('user_ratings')
          .select('id, rating, comment, created_at')
          .eq('rated_user_id', sellerId)
          .eq('rater_role', 'customer')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('store_products')
          .select('id')
          .eq('seller_id', sellerId),
      ]);

      const userRatings = (userRatingsResult.data || []) as UnifiedRating[];
      const productIds = (productRatingsResult.data || []).map((p: { id: string }) => p.id);

      let productRatings: UnifiedRating[] = [];
      if (productIds.length > 0) {
        const { data: prData } = await supabase
          .from('product_ratings')
          .select('id, rating, comment, created_at')
          .in('product_id', productIds)
          .order('created_at', { ascending: false })
          .limit(20);
        productRatings = (prData || []) as UnifiedRating[];
      }

      const combined = [...userRatings, ...productRatings].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setRatings(combined);
      if (combined.length > 0) {
        const sum = combined.reduce((acc, r) => acc + r.rating, 0);
        setAvgRating(sum / combined.length);
      } else {
        setAvgRating(0);
      }
    } catch (err) {
      console.error('Error loading ratings:', err);
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    loadRatings();
  }, [loadRatings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  const totalRatings = ratings.length;
  const hasRatings = totalRatings > 0;
  const tier = getTierFromRating(avgRating);
  const tierConfig = TIER_CONFIG[tier];
  const displayRatings = showAllComments ? ratings : ratings.slice(0, 3);
  const filledSegments = hasRatings ? Math.ceil(avgRating) : 0;

  const segments: ReputationTier[] = ['pessimo', 'ruim', 'medio', 'bom', 'muito_bom'];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <Star className="h-5 w-5 text-amber-500" />
        <h3 className="text-base font-bold text-gray-900 dark:text-white">
          {tr('Reputação do Vendedor', 'Seller Reputation', 'Reputación del Vendedor')}
        </h3>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-4 mb-5">
          <div className={`relative w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 ${hasRatings ? tierConfig.bgColor : 'bg-gray-100 dark:bg-gray-700'}`}>
            <span className="text-3xl font-bold" style={{ color: hasRatings ? tierConfig.color : '#9ca3af' }}>
              {hasRatings ? avgRating.toFixed(1) : '—'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${hasRatings ? tierConfig.textColor : 'text-gray-500 dark:text-gray-400'}`}>
              {hasRatings
                ? tr(tierConfig.label.pt, tierConfig.label.en, tierConfig.label.es)
                : tr('Sem Avaliações', 'No Reviews', 'Sin Reseñas')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {hasRatings
                ? tr(
                    `${totalRatings} avaliações de clientes`,
                    `${totalRatings} customer reviews`,
                    `${totalRatings} reseñas de clientes`
                  )
                : tr(
                    'Nenhuma avaliação ainda',
                    'No reviews yet',
                    'Aún no hay reseñas'
                  )}
            </p>
          </div>
        </div>

        <div className="mb-5">
          <div className="flex gap-1.5 h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
            {segments.map((seg, idx) => {
              const segConfig = TIER_CONFIG[seg];
              const isFilled = idx < filledSegments;
              return (
                <div
                  key={seg}
                  className="flex-1 rounded-sm transition-all duration-500"
                  style={{
                    backgroundColor: isFilled ? segConfig.color : 'transparent',
                  }}
                  title={tr(segConfig.label.pt, segConfig.label.en, segConfig.label.es)}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-2 px-0.5">
            {segments.map((seg, idx) => {
              const segConfig = TIER_CONFIG[seg];
              const isFilled = idx < filledSegments;
              return (
                <span
                  key={seg}
                  className={`text-[10px] font-medium transition-opacity ${isFilled ? 'opacity-100' : 'opacity-40'}`}
                  style={{ color: isFilled ? segConfig.color : undefined }}
                >
                  {idx + 1}
                </span>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-1.5 mb-1">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Star
                key={idx}
                className={`h-3.5 w-3.5 ${hasRatings && idx < Math.round(avgRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
              />
            ))}
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
              {hasRatings ? `${avgRating.toFixed(1)} / 5.0` : tr('Sem avaliações', 'No ratings', 'Sin calificaciones')}
            </span>
          </div>
        </div>

        {hasRatings && ratings.some((r) => r.comment) && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {tr('Avaliações Recentes', 'Recent Reviews', 'Reseñas Recientes')}
            </h4>
            {displayRatings.filter((r) => r.comment).map((rating) => (
              <div key={rating.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/40">
                <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star
                      key={idx}
                      className={`h-3 w-3 ${idx < rating.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{rating.comment}</p>
              </div>
            ))}
            {ratings.filter((r) => r.comment).length > 3 && (
              <button
                onClick={() => setShowAllComments(!showAllComments)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                {showAllComments
                  ? tr('Ver menos', 'Show less', 'Ver menos')
                  : tr(`Ver todos os ${ratings.filter((r) => r.comment).length} comentários`, `Show all ${ratings.filter((r) => r.comment).length} reviews`, `Ver las ${ratings.filter((r) => r.comment).length} reseñas`)}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
