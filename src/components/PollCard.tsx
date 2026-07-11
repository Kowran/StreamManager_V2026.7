import React, { useState, useEffect } from 'react';
import { BarChart3, Clock, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useTheme } from './ThemeProvider';

interface Poll {
  id: string;
  post_id: string;
  question: string;
  options: string[];
  ends_at: string | null;
  multiple_choice: boolean;
  created_at: string;
}

interface PollVote {
  option_index: number;
  count: number;
}

interface PollCardProps {
  poll: Poll;
  onVoteUpdate?: () => void;
}

export default function PollCard({ poll, onVoteUpdate }: PollCardProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [userVotes, setUserVotes] = useState<number[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
    loadVotes();
  }, [poll.id]);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id || null);
  };

  const loadVotes = async () => {
    try {
      const { data: votesData, error } = await supabase
        .from('community_poll_votes')
        .select('option_index, user_id')
        .eq('poll_id', poll.id);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();

      const voteCounts: { [key: number]: number } = {};
      const userVoteIndices: number[] = [];

      votesData?.forEach((vote) => {
        voteCounts[vote.option_index] = (voteCounts[vote.option_index] || 0) + 1;
        if (user && vote.user_id === user.id) {
          userVoteIndices.push(vote.option_index);
        }
      });

      const voteArray: PollVote[] = poll.options.map((_, index) => ({
        option_index: index,
        count: voteCounts[index] || 0
      }));

      setVotes(voteArray);
      setUserVotes(userVoteIndices);
      setHasVoted(userVoteIndices.length > 0);
      setTotalVotes(votesData?.length || 0);
    } catch (error) {
      console.error('Error loading votes:', error);
    }
  };

  const handleVote = async (optionIndex: number) => {
    if (!userId || loading) return;

    const isExpired = poll.ends_at && new Date(poll.ends_at) < new Date();
    if (isExpired) return;

    setLoading(true);

    try {
      const isSelected = userVotes.includes(optionIndex);

      if (isSelected) {
        await supabase
          .from('community_poll_votes')
          .delete()
          .eq('poll_id', poll.id)
          .eq('user_id', userId)
          .eq('option_index', optionIndex);
      } else {
        if (!poll.multiple_choice && userVotes.length > 0) {
          await supabase
            .from('community_poll_votes')
            .delete()
            .eq('poll_id', poll.id)
            .eq('user_id', userId);
        }

        await supabase
          .from('community_poll_votes')
          .insert({
            poll_id: poll.id,
            user_id: userId,
            option_index: optionIndex
          });
      }

      await loadVotes();
      onVoteUpdate?.();
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPercentage = (count: number): number => {
    if (totalVotes === 0) return 0;
    return Math.round((count / totalVotes) * 100);
  };

  const isExpired = poll.ends_at && new Date(poll.ends_at) < new Date();
  const canVote = !isExpired && userId;

  return (
    <div
      className={`rounded-xl shadow-md overflow-hidden ${
        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
      }`}
    >
      <div className={`px-6 py-4 ${
        theme === 'dark' ? 'bg-gray-750 border-b border-gray-700' : 'bg-gray-50 border-b border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <h3 className={`text-xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}>
            {poll.question}
          </h3>
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Users className="w-4 h-4" />
            <span>
              {totalVotes} {t.language === 'pt' ? 'votos' : t.language === 'en' ? 'votes' : 'votos'}
            </span>
          </div>
          {poll.ends_at && (
            <div className={`flex items-center gap-1 text-sm ${
              isExpired ? 'text-red-500' : 'text-gray-500'
            }`}>
              <Clock className="w-4 h-4" />
              <span>
                {isExpired
                  ? (t.language === 'pt' ? 'Encerrada' : t.language === 'en' ? 'Ended' : 'Finalizada')
                  : (t.language === 'pt' ? 'Termina em' : t.language === 'en' ? 'Ends' : 'Termina') + ' ' +
                    new Date(poll.ends_at).toLocaleDateString(
                      t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES',
                      { day: '2-digit', month: 'short', year: 'numeric' }
                    )}
              </span>
            </div>
          )}
        </div>
        {poll.multiple_choice && (
          <div className={`mt-2 text-sm ${
            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
          }`}>
            {t.language === 'pt' ? 'Múltipla escolha' : t.language === 'en' ? 'Multiple choice' : 'Opción múltiple'}
          </div>
        )}
      </div>

      <div className="p-6 space-y-3">
        {poll.options.map((option, index) => {
          const voteData = votes.find(v => v.option_index === index);
          const voteCount = voteData?.count || 0;
          const percentage = getPercentage(voteCount);
          const isSelected = userVotes.includes(index);

          return (
            <button
              key={index}
              onClick={() => canVote && handleVote(index)}
              disabled={!canVote || loading}
              className={`w-full text-left rounded-lg overflow-hidden transition-all duration-200 ${
                !canVote || loading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:shadow-md'
              } ${
                isSelected
                  ? theme === 'dark'
                    ? 'ring-2 ring-blue-500'
                    : 'ring-2 ring-blue-400'
                  : ''
              }`}
            >
              <div className={`relative p-4 ${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
              }`}>
                <div
                  className={`absolute inset-0 transition-all duration-300 ${
                    theme === 'dark' ? 'bg-blue-900/40' : 'bg-blue-200/60'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
                <div className="relative flex items-center justify-between">
                  <span className={`font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    {option}
                  </span>
                  <div className="flex items-center gap-3">
                    {hasVoted && (
                      <span className={`text-sm font-semibold ${
                        theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        {percentage}%
                      </span>
                    )}
                    {hasVoted && (
                      <span className={`text-sm ${
                        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        ({voteCount})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {!userId && (
        <div className={`px-6 pb-6 text-center text-sm ${
          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {t.language === 'pt' ? 'Faça login para votar' : t.language === 'en' ? 'Log in to vote' : 'Inicia sesión para votar'}
        </div>
      )}
    </div>
  );
}
