import React, { useState, useEffect, useCallback } from 'react';
import { Loader, Star, AlertTriangle, Ban, ShieldAlert, Clock, Info } from 'lucide-react';
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

interface PenaltyInfo {
  penalty_count: number;
  store_suspended: boolean;
  store_permanently_suspended: boolean;
}

type ReputationTier = 'pessimo' | 'ruim' | 'medio' | 'bom' | 'muito_bom';

const TIER_CONFIG: Record<ReputationTier, { color: string; bgColor: string; textColor: string; label: { pt: string; en: string; es: string } }> = {
  pessimo: { color: '#dc2626', bgColor: 'bg-red-100 dark:bg-red-900/30', textColor: 'text-red-700 dark:text-red-400', label: { pt: 'Péssimo', en: 'Terrible', es: 'Pésimo' } },
  ruim: { color: '#f87171', bgColor: 'bg-red-50 dark:bg-red-900/20', textColor: 'text-red-500 dark:text-red-300', label: { pt: 'Ruim', en: 'Poor', es: 'Malo' } },
  medio: { color: '#eab308', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', textColor: 'text-yellow-700 dark:text-yellow-400', label: { pt: 'Médio', en: 'Average', es: 'Medio' } },
  bom: { color: '#4ade80', bgColor: 'bg-green-50 dark:bg-green-900/20', textColor: 'text-green-600 dark:text-green-400', label: { pt: 'Bom', en: 'Good', es: 'Bueno' } },
  muito_bom: { color: '#16a34a', bgColor: 'bg-green-100 dark:bg-green-900/30', textColor: 'text-green-700 dark:text-green-500', label: { pt: 'Muito Bom', en: 'Very Good', es: 'Muy Bueno' } },
};

const PENALTY_LABELS: Record<number, { pt: string; en: string; es: string }> = {
  1: { pt: 'Advertência', en: 'Warning', es: 'Advertencia' },
  2: { pt: 'Suspensão', en: 'Suspension', es: 'Suspensión' },
  3: { pt: 'Suspensão Permanente', en: 'Permanent Suspension', es: 'Suspensión Permanente' },
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
  const [penaltyInfo, setPenaltyInfo] = useState<PenaltyInfo | null>(null);
  const [penalties, setPenalties] = useState<any[]>([]);

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

      // Load penalty info
      const { data: profile } = await supabase
        .from('profiles')
        .select('penalty_count, store_suspended, store_permanently_suspended')
        .eq('id', sellerId)
        .maybeSingle();

      if (profile) {
        setPenaltyInfo(profile as PenaltyInfo);
      }

      // Load active penalties
      const { data: penaltyData } = await supabase
        .from('seller_penalties')
        .select('id, penalty_level, reason, applied_at, is_active')
        .eq('seller_id', sellerId)
        .order('applied_at', { ascending: false });

      setPenalties(penaltyData || []);
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

  const penaltyCount = penaltyInfo?.penalty_count || 0;
  const isSuspended = penaltyInfo?.store_suspended || false;
  const isPermanent = penaltyInfo?.store_permanently_suspended || false;
  const currentPenaltyLevel = isPermanent ? 3 : isSuspended ? 2 : penaltyCount > 0 ? 1 : 0;
  const activePenalties = penalties.filter((p: any) => p.is_active);

  return (
    <div className="space-y-4">
      {/* Penalty Status Card */}
      {penaltyCount > 0 && (
        <div className={`rounded-2xl shadow-sm border-2 overflow-hidden ${
          currentPenaltyLevel === 3 ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' :
          currentPenaltyLevel === 2 ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20' :
          'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
        }`}>
          <div className="px-5 py-4 border-b border-current/10 flex items-center gap-2">
            {currentPenaltyLevel === 3 ? <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" /> :
             currentPenaltyLevel === 2 ? <Ban className="h-5 w-5 text-orange-600 dark:text-orange-400" /> :
             <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
            <h3 className={`text-base font-bold ${
              currentPenaltyLevel === 3 ? 'text-red-700 dark:text-red-400' :
              currentPenaltyLevel === 2 ? 'text-orange-700 dark:text-orange-400' :
              'text-amber-700 dark:text-amber-400'
            }`}>
              {tr('Status da Loja', 'Store Status', 'Estado de la Tienda')}
            </h3>
          </div>
          <div className="p-5">
            {/* Penalty Level Indicator */}
            <div className="flex items-center gap-2 mb-4">
              {[1, 2, 3].map(n => (
                <div key={n} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`w-full h-2.5 rounded-full transition-all ${
                    n <= penaltyCount
                      ? n === 3 ? 'bg-red-500' : n === 2 ? 'bg-orange-500' : 'bg-amber-500'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                  <span className={`text-[10px] font-medium ${
                    n <= penaltyCount
                      ? n === 3 ? 'text-red-600 dark:text-red-400' : n === 2 ? 'text-orange-600 dark:text-orange-400' : 'text-amber-600 dark:text-amber-400'
                      : 'text-gray-400'
                  }`}>
                    {tr(`Nível ${n}`, `Level ${n}`, `Nivel ${n}`)}
                  </span>
                </div>
              ))}
            </div>

            {/* Current Status Badge */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
              currentPenaltyLevel === 3 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
              currentPenaltyLevel === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' :
              'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
            }`}>
              {currentPenaltyLevel === 3 ? <ShieldAlert className="h-4 w-4" /> :
               currentPenaltyLevel === 2 ? <Ban className="h-4 w-4" /> :
               <AlertTriangle className="h-4 w-4" />}
              {PENALTY_LABELS[currentPenaltyLevel] ? tr(PENALTY_LABELS[currentPenaltyLevel].pt, PENALTY_LABELS[currentPenaltyLevel].en, PENALTY_LABELS[currentPenaltyLevel].es) : ''}
            </div>

            {/* Status Description */}
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 leading-relaxed">
              {currentPenaltyLevel === 1 && tr(
                'Sua loja recebeu uma advertência. Esta é apenas um aviso — sua loja continua funcionando normalmente. Regularize sua situação para evitar suspensões futuras.',
                'Your store received a warning. This is just a notice — your store continues to operate normally. Regularize your situation to avoid future suspensions.',
                'Tu tienda recibió una advertencia. Esto es solo un aviso — tu tienda sigue funcionando normalmente. Regulariza tu situación para evitar futuras suspensiones.'
              )}
              {currentPenaltyLevel === 2 && tr(
                'Sua loja está suspensa. Seus anúncios foram ocultados e as vendas estão suspensas. Entre em contato com o suporte para regularizar.',
                'Your store is suspended. Your listings have been hidden and sales are suspended. Contact support to regularize.',
                'Tu tienda está suspendida. Tus anuncios han sido ocultados y las ventas están suspendidas. Contacta con soporte para regularizar.'
              )}
              {currentPenaltyLevel === 3 && tr(
                'Sua loja foi suspensa permanentemente. Seu saldo está congelado e saques estão bloqueados. Entre em contato com o suporte para mais informações.',
                'Your store has been permanently suspended. Your balance is frozen and withdrawals are blocked. Contact support for more information.',
                'Tu tienda ha sido suspendida permanentemente. Tu saldo está congelado y los retiros están bloqueados. Contacta con soporte para más información.'
              )}
            </p>

            {/* Active Penalties List */}
            {activePenalties.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {tr('Punições Ativas', 'Active Penalties', 'Penalizaciones Activas')}
                </h4>
                {activePenalties.map((penalty: any) => (
                  <div key={penalty.id} className={`flex items-start gap-2 p-2.5 rounded-lg ${
                    penalty.penalty_level === 3 ? 'bg-red-100/50 dark:bg-red-900/20' :
                    penalty.penalty_level === 2 ? 'bg-orange-100/50 dark:bg-orange-900/20' :
                    'bg-amber-100/50 dark:bg-amber-900/20'
                  }`}>
                    {penalty.penalty_level === 3 ? <ShieldAlert className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" /> :
                     penalty.penalty_level === 2 ? <Ban className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" /> :
                     <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {PENALTY_LABELS[penalty.penalty_level] ? tr(PENALTY_LABELS[penalty.penalty_level].pt, PENALTY_LABELS[penalty.penalty_level].en, PENALTY_LABELS[penalty.penalty_level].es) : ''}
                      </p>
                      {penalty.reason && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{penalty.reason}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400">
                        <Clock className="h-3 w-3" />
                        {new Date(penalty.applied_at).toLocaleString(language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'es-ES')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reputation Card */}
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
    </div>
  );
}
