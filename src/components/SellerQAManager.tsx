import React, { useState, useEffect, useCallback } from 'react';
import { HelpCircle, Send, Loader, Search, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface Question {
  id: string;
  product_id: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  asker_id: string;
  product_name?: string;
  product_image?: string | null;
  asker_profile?: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
}

export function SellerQAManager() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unanswered' | 'answered'>('unanswered');
  const [search, setSearch] = useState('');
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const tr = (pt: string, en: string, es: string) =>
    t.language === 'pt' ? pt : t.language === 'en' ? en : es;

  const loadQuestions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_questions')
        .select('id, product_id, question, answer, answered_at, created_at, asker_id')
        .eq('seller_id', user.id)
        .order('answered_at', { ascending: false, nullsFirst: true })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const productIds = [...new Set((data || []).map(q => q.product_id))];
      const askerIds = [...new Set((data || []).map(q => q.asker_id))];

      const [productsRes, profilesRes] = await Promise.all([
        productIds.length
          ? supabase.from('store_products').select('id, name, image_url').in('id', productIds)
          : Promise.resolve({ data: [] }),
        askerIds.length
          ? supabase.from('profiles').select('id, username, full_name, avatar_url').in('id', askerIds)
          : Promise.resolve({ data: [] }),
      ]);

      const productMap = new Map((productsRes.data || []).map((p: any) => [p.id, p]));
      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));

      const enriched = (data || []).map(q => ({
        ...q,
        product_name: productMap.get(q.product_id)?.name || 'Produto',
        product_image: productMap.get(q.product_id)?.image_url || null,
        asker_profile: profileMap.get(q.asker_id) || null,
      })) as Question[];

      setQuestions(enriched);
    } catch (err) {
      console.error('Error loading questions:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  async function submitAnswer(questionId: string) {
    if (!user || !answerText.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('product_questions')
        .update({
          answer: answerText.trim(),
          answered_at: new Date().toISOString(),
          answered_by: user.id,
        })
        .eq('id', questionId);
      if (error) throw error;
      setAnswerText('');
      setAnsweringId(null);
      loadQuestions();
    } catch (err: any) {
      alert(err.message || tr('Erro ao responder', 'Error answering', 'Error al responder'));
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(
      t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES',
      { day: '2-digit', month: 'short', year: 'numeric' }
    );
  }

  const filtered = questions.filter(q => {
    if (filter === 'unanswered' && q.answer) return false;
    if (filter === 'answered' && !q.answer) return false;
    if (search) {
      const s = search.toLowerCase();
      return q.question.toLowerCase().includes(s) || (q.product_name || '').toLowerCase().includes(s);
    }
    return true;
  });

  const unansweredCount = questions.filter(q => !q.answer).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {tr('Perguntas dos Clientes', 'Customer Questions', 'Preguntas de Clientes')}
          </h2>
          {unansweredCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
              {unansweredCount} {tr('pendentes', 'pending', 'pendientes')}
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {(['unanswered', 'answered', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === f
                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {f === 'unanswered' ? tr('Pendentes', 'Pending', 'Pendientes') :
                 f === 'answered' ? tr('Respondidas', 'Answered', 'Respondidas') :
                 tr('Todas', 'All', 'Todas')}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr('Buscar perguntas ou produtos...', 'Search questions or products...', 'Buscar preguntas o productos...')}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Questions */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageCircle className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filter === 'unanswered'
                ? tr('Nenhuma pergunta pendente. Tudo em dia!', 'No pending questions. All caught up!', '¡Sin preguntas pendientes. ¡Todo al día!')
                : tr('Nenhuma pergunta encontrada.', 'No questions found.', 'No se encontraron preguntas.')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((q) => (
              <div key={q.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Product reference */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                  {q.product_image ? (
                    <img src={q.product_image} alt="" className="h-6 w-6 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div className="h-6 w-6 rounded bg-gray-200 dark:bg-gray-700" />
                  )}
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">{q.product_name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{formatDate(q.created_at)}</span>
                </div>

                {/* Question */}
                <div className="p-3.5">
                  <div className="flex items-start gap-2.5">
                    {q.asker_profile?.avatar_url ? (
                      <img src={q.asker_profile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {(q.asker_profile?.full_name || q.asker_profile?.username || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {q.asker_profile?.full_name || q.asker_profile?.username || tr('Usuário', 'User', 'Usuario')}
                      </span>
                      <p className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 leading-relaxed">{q.question}</p>
                    </div>
                  </div>
                </div>

                {/* Answer or answer form */}
                {q.answer ? (
                  <div className="px-3.5 pb-3.5">
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/15 border border-blue-100 dark:border-blue-900/30">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                        {tr('Sua resposta', 'Your answer', 'Tu respuesta')}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{q.answer}</p>
                    </div>
                  </div>
                ) : answeringId === q.id ? (
                  <div className="px-3.5 pb-3.5">
                    <textarea
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder={tr('Digite sua resposta...', 'Type your answer...', 'Escribe tu respuesta...')}
                      rows={3}
                      maxLength={1000}
                      autoFocus
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => { setAnsweringId(null); setAnswerText(''); }}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        {tr('Cancelar', 'Cancel', 'Cancelar')}
                      </button>
                      <button
                        onClick={() => submitAnswer(q.id)}
                        disabled={submitting || !answerText.trim()}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {submitting ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        {tr('Publicar Resposta', 'Publish Answer', 'Publicar Respuesta')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-3.5 pb-3.5">
                    <button
                      onClick={() => { setAnsweringId(q.id); setAnswerText(''); }}
                      className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      <Send className="h-4 w-4" />
                      {tr('Responder', 'Reply', 'Responder')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
