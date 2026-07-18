import React, { useState, useEffect, useCallback } from 'react';
import { ThumbsUp, ThumbsDown, ShieldCheck, ShieldAlert, Loader, MessageSquare } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';
import { LoginModal } from './LoginModal';

interface SellerReputationProps {
  sellerId: string;
  sellerName?: string;
}

interface ReputationVote {
  id: string;
  is_trustworthy: boolean;
  comment: string | null;
  voter_id: string;
  created_at: string;
}

interface ReputationSummary {
  total_votes: number;
  trustworthy_votes: number;
  not_trustworthy_votes: number;
  trust_score: number;
}

export function SellerReputation({ sellerId, sellerName }: SellerReputationProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [summary, setSummary] = useState<ReputationSummary>({ total_votes: 0, trustworthy_votes: 0, not_trustworthy_votes: 0, trust_score: 0 });
  const [recentVotes, setRecentVotes] = useState<ReputationVote[]>([]);
  const [userVote, setUserVote] = useState<ReputationVote | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showVoteForm, setShowVoteForm] = useState(false);
  const [voteChoice, setVoteChoice] = useState<boolean>(true);
  const [voteComment, setVoteComment] = useState('');
  const [showAllComments, setShowAllComments] = useState(false);

  const tr = (pt: string, en: string, es: string) =>
    t.language === 'pt' ? pt : t.language === 'en' ? en : es;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: summaryData } = await supabase
        .rpc('get_seller_reputation_summary', { sid: sellerId });
      if (summaryData) setSummary(summaryData as ReputationSummary);

      const { data: votes } = await supabase
        .from('seller_reputation_votes')
        .select('id, is_trustworthy, comment, voter_id, created_at')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (votes) setRecentVotes(votes as ReputationVote[]);

      if (user) {
        const { data: myVote } = await supabase
          .from('seller_reputation_votes')
          .select('id, is_trustworthy, comment, voter_id, created_at')
          .eq('seller_id', sellerId)
          .eq('voter_id', user.id)
          .maybeSingle();
        if (myVote) setUserVote(myVote as ReputationVote);
      }
    } catch (err) {
      console.error('Error loading reputation:', err);
    } finally {
      setLoading(false);
    }
  }, [sellerId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function submitVote() {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    setSubmitting(true);
    try {
      if (userVote) {
        const { error } = await supabase
          .from('seller_reputation_votes')
          .update({ is_trustworthy: voteChoice, comment: voteComment || null, updated_at: new Date().toISOString() })
          .eq('id', userVote.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('seller_reputation_votes')
          .insert({
            seller_id: sellerId,
            voter_id: user.id,
            is_trustworthy: voteChoice,
            comment: voteComment || null,
          });
        if (error) throw error;
      }
      setShowVoteForm(false);
      setVoteComment('');
      loadData();
    } catch (err: any) {
      alert(err.message || tr('Erro ao registrar voto', 'Error registering vote', 'Error al registrar voto'));
    } finally {
      setSubmitting(false);
    }
  }

  function openVoteForm(trustworthy: boolean) {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    setVoteChoice(trustworthy);
    setVoteComment(userVote?.comment || '');
    setShowVoteForm(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  const trustScore = summary.trust_score;
  const isTrusted = summary.total_votes >= 5 && trustScore >= 70;
  const isNotTrusted = summary.total_votes >= 5 && trustScore < 40;
  const displayVotes = showAllComments ? recentVotes : recentVotes.slice(0, 3);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-base font-bold text-gray-900 dark:text-white">
          {tr('Reputação do Vendedor', 'Seller Reputation', 'Reputación del Vendedor')}
        </h3>
      </div>

      <div className="p-5">
        {/* Trust badge */}
        {summary.total_votes > 0 ? (
          <div className="flex items-center gap-4 mb-5">
            <div className={`relative w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 ${
              isTrusted
                ? 'bg-green-100 dark:bg-green-900/30'
                : isNotTrusted
                ? 'bg-red-100 dark:bg-red-900/30'
                : 'bg-yellow-100 dark:bg-yellow-900/30'
            }`}>
              {isTrusted ? (
                <ShieldCheck className="h-10 w-10 text-green-600 dark:text-green-400" />
              ) : isNotTrusted ? (
                <ShieldAlert className="h-10 w-10 text-red-600 dark:text-red-400" />
              ) : (
                <ShieldCheck className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
              )}
              <span className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full px-1.5 py-0.5 text-xs font-bold text-gray-700 dark:text-gray-300 shadow border border-gray-200 dark:border-gray-600">
                {trustScore}%
              </span>
            </div>
            <div className="flex-1 min-w-0">
              {isTrusted ? (
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {tr('Vendedor Confiável', 'Trusted Seller', 'Vendedor Confiable')}
                </p>
              ) : isNotTrusted ? (
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                  {tr('Compre com Cautela', 'Buy with Caution', 'Compra con Precaución')}
                </p>
              ) : (
                <p className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                  {tr('Reputação em Construção', 'Building Reputation', 'Reputación en Construcción')}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {tr(
                  `${summary.trustworthy_votes} confiáveis · ${summary.not_trustworthy_votes} não confiáveis · ${summary.total_votes} total`,
                  `${summary.trustworthy_votes} trustworthy · ${summary.not_trustworthy_votes} not trustworthy · ${summary.total_votes} total`,
                  `${summary.trustworthy_votes} confiables · ${summary.not_trustworthy_votes} no confiables · ${summary.total_votes} total`
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 mb-5 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl">
            <ShieldCheck className="h-8 w-8 text-gray-400 flex-shrink-0" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr(
                'Este vendedor ainda não possui avaliações de reputação. Seja o primeiro a avaliar!',
                'This seller has no reputation votes yet. Be the first to rate!',
                'Este vendedor aún no tiene votos de reputación. ¡Sé el primero en calificar!'
              )}
            </p>
          </div>
        )}

        {/* Vote buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => openVoteForm(true)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
              userVote?.is_trustworthy
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-2 border-green-300 dark:border-green-700'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20 border-2 border-transparent'
            }`}
          >
            <ThumbsUp className="h-4 w-4" />
            {tr('Confiável', 'Trustworthy', 'Confiable')}
          </button>
          <button
            onClick={() => openVoteForm(false)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
              userVote && !userVote.is_trustworthy
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-2 border-red-300 dark:border-red-700'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 border-2 border-transparent'
            }`}
          >
            <ThumbsDown className="h-4 w-4" />
            {tr('Não Confiável', 'Not Trustworthy', 'No Confiable')}
          </button>
        </div>

        {userVote && (
          <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-3">
            {tr('Você já avaliou este vendedor', 'You already rated this seller', 'Ya calificaste a este vendedor')}
          </p>
        )}

        {/* Recent comments */}
        {recentVotes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              {tr('Comentários Recentes', 'Recent Comments', 'Comentarios Recientes')}
            </h4>
            {displayVotes.filter(v => v.comment).map((vote) => (
              <div key={vote.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/40">
                {vote.is_trustworthy ? (
                  <ThumbsUp className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <ThumbsDown className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{vote.comment}</p>
              </div>
            ))}
            {recentVotes.length > 3 && (
              <button
                onClick={() => setShowAllComments(!showAllComments)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                {showAllComments
                  ? tr('Ver menos', 'Show less', 'Ver menos')
                  : tr(`Ver todos os ${recentVotes.length} comentários`, `Show all ${recentVotes.length} comments`, `Ver los ${recentVotes.length} comentarios`)}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Vote form modal */}
      {showVoteForm && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {voteChoice
                ? tr('Avaliar como Confiável', 'Rate as Trustworthy', 'Calificar como Confiable')
                : tr('Avaliar como Não Confiável', 'Rate as Not Trustworthy', 'Calificar como No Confiable')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {sellerName ? `${sellerName}` : ''}
            </p>
            <textarea
              value={voteComment}
              onChange={(e) => setVoteComment(e.target.value)}
              placeholder={tr(
                'Conte sua experiência (opcional)...',
                'Share your experience (optional)...',
                'Comparte tu experiencia (opcional)...'
              )}
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowVoteForm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {tr('Cancelar', 'Cancel', 'Cancelar')}
              </button>
              <button
                onClick={submitVote}
                disabled={submitting}
                className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm text-white transition-colors ${
                  voteChoice
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50`}
              >
                {submitting ? <Loader className="h-4 w-4 animate-spin mx-auto" /> : tr('Enviar Avaliação', 'Submit Rating', 'Enviar Calificación')}
              </button>
            </div>
          </div>
        </div>
      )}

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onLoginSuccess={() => setShowLoginModal(false)} />
    </div>
  );
}
