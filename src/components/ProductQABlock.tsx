import React, { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Send, Reply, Loader, CheckCircle2, HelpCircle } from 'lucide-react';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';
import { supabase } from '../lib/supabase';
import { LoginModal } from './LoginModal';

interface ProductQABlockProps {
  productId: string;
  sellerId: string | null;
}

interface Question {
  id: string;
  question: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  asker_id: string;
  asker_profile?: { username: string | null; full_name: string | null; avatar_url: string | null } | null;
}

export function ProductQABlock({ productId, sellerId }: ProductQABlockProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<{ role: string } | null>(null);

  const tr = (pt: string, en: string, es: string) =>
    t.language === 'pt' ? pt : t.language === 'en' ? en : es;

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_questions')
        .select('id, question, answer, answered_at, created_at, asker_id')
        .eq('product_id', productId)
        .order('answered_at', { ascending: false, nullsFirst: true })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const askerIds = [...new Set((data || []).map(q => q.asker_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', askerIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      const enriched = (data || []).map(q => ({
        ...q,
        asker_profile: profileMap.get(q.asker_id) || null,
      })) as Question[];

      setQuestions(enriched);
    } catch (err) {
      console.error('Error loading questions:', err);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setUserProfile(data as { role: string });
        });
    }
  }, [user]);

  async function submitQuestion() {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!newQuestion.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('product_questions')
        .insert({
          product_id: productId,
          asker_id: user.id,
          question: newQuestion.trim(),
        });
      if (error) throw error;
      setNewQuestion('');
      loadQuestions();
    } catch (err: any) {
      alert(err.message || tr('Erro ao enviar pergunta', 'Error sending question', 'Error al enviar pregunta'));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAnswer(questionId: string) {
    if (!user || !answerText.trim()) return;
    setAnswerSubmitting(true);
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
      setAnswerSubmitting(false);
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString(t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  const canAnswer = (q: Question) => {
    if (!user || q.answer) return false;
    if (userProfile?.role === 'admin') return true;
    return sellerId === user.id;
  };

  const unanswered = questions.filter(q => !q.answer).length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-base font-bold text-gray-900 dark:text-white">
          {tr('Perguntas e Respostas', 'Questions & Answers', 'Preguntas y Respuestas')}
        </h3>
        {unanswered > 0 && (
          <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
            {unanswered} {tr('sem resposta', 'unanswered', 'sin respuesta')}
          </span>
        )}
      </div>

      <div className="p-5">
        {/* Ask a question */}
        <div className="mb-5">
          <div className="flex gap-2">
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !submitting) submitQuestion(); }}
              placeholder={tr('Faça uma pergunta ao vendedor...', 'Ask the seller a question...', 'Haz una pregunta al vendedor...')}
              maxLength={500}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={submitQuestion}
              disabled={submitting || !newQuestion.trim()}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {submitting ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="hidden sm:inline">{tr('Enviar', 'Send', 'Enviar')}</span>
            </button>
          </div>
          {!user && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
              {tr('Entre para fazer perguntas', 'Sign in to ask questions', 'Inicia sesión para hacer preguntas')}
            </p>
          )}
        </div>

        {/* Questions list */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        ) : questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageCircle className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {tr('Nenhuma pergunta ainda. Seja o primeiro!', 'No questions yet. Be the first!', '¡Aún no hay preguntas. ¡Sé el primero!')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Question */}
                <div className="p-3.5 bg-gray-50 dark:bg-gray-900/40">
                  <div className="flex items-start gap-2.5">
                    {q.asker_profile?.avatar_url ? (
                      <img
                        src={q.asker_profile.avatar_url}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {(q.asker_profile?.full_name || q.asker_profile?.username || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {q.asker_profile?.full_name || q.asker_profile?.username || tr('Usuário', 'User', 'Usuario')}
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(q.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-800 dark:text-gray-200 mt-1 leading-relaxed">{q.question}</p>
                    </div>
                  </div>
                </div>

                {/* Answer */}
                {q.answer ? (
                  <div className="p-3.5 bg-blue-50 dark:bg-blue-900/15 border-t border-blue-100 dark:border-blue-900/30">
                    <div className="flex items-start gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                        <Reply className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                            {tr('Resposta do Vendedor', 'Seller Reply', 'Respuesta del Vendedor')}
                          </span>
                          {q.answered_at && (
                            <span className="text-xs text-blue-400">{formatDate(q.answered_at)}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">{q.answer}</p>
                      </div>
                    </div>
                  </div>
                ) : canAnswer(q) ? (
                  answeringId === q.id ? (
                    <div className="p-3.5 border-t border-gray-200 dark:border-gray-700">
                      <textarea
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        placeholder={tr('Digite sua resposta...', 'Type your answer...', 'Escribe tu respuesta...')}
                        rows={2}
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
                          disabled={answerSubmitting || !answerText.trim()}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {answerSubmitting ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          {tr('Responder', 'Reply', 'Responder')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => { setAnsweringId(q.id); setAnswerText(''); }}
                        className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        <Reply className="h-4 w-4" />
                        {tr('Responder pergunta', 'Answer question', 'Responder pregunta')}
                      </button>
                    </div>
                  )
                ) : (
                  <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {tr('Aguardando resposta do vendedor', 'Awaiting seller response', 'Esperando respuesta del vendedor')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onLoginSuccess={() => setShowLoginModal(false)} />
    </div>
  );
}
