import React, { useState } from 'react';
import { Ban, MessageSquare, Send, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';

export function BannedScreen({ banReason }: { banReason: string | null }) {
  const { t, language } = useLanguage();
  const { user, signOut } = useAuth();
  const [appealReason, setAppealReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [existingAppeal, setExistingAppeal] = useState(false);

  const tr = (pt: string, en: string, es: string) => language === 'pt' ? pt : language === 'en' ? en : es;

  React.useEffect(() => {
    checkExistingAppeal();
  }, [user]);

  async function checkExistingAppeal() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('ban_appeals')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) setExistingAppeal(true);
    } catch {
      // ignore
    }
  }

  async function submitAppeal() {
    if (!user || !appealReason.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const { error } = await supabase
        .from('ban_appeals')
        .insert({
          user_id: user.id,
          appeal_reason: appealReason.trim(),
          ban_reason_snapshot: banReason,
        });
      if (error) throw error;
      setSubmitted(true);
      setExistingAppeal(true);
    } catch (err: any) {
      setError(err.message || tr('Erro ao enviar recurso', 'Error submitting appeal', 'Error al enviar apelación'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-red-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="bg-gradient-to-br from-red-500 to-red-600 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-4">
              <Ban className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">
              {tr('Conta Suspensa', 'Account Suspended', 'Cuenta Suspendida')}
            </h1>
            <p className="text-sm text-red-100">
              {tr('Sua conta foi banida', 'Your account has been banned', 'Tu cuenta ha sido baneada')}
            </p>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Ban reason */}
            {banReason && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
                <p className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide mb-1">
                  {tr('Motivo', 'Reason', 'Razón')}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{banReason}</p>
              </div>
            )}

            {/* Appeal form */}
            {!submitted && !existingAppeal ? (
              <>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                    {tr(
                      'Você pode solicitar uma revisão do seu banimento. Descreva o motivo pelo qual você acredita que o banimento deve ser revogado.',
                      'You can request a review of your ban. Describe why you believe the ban should be lifted.',
                      'Puedes solicitar una revisión de tu ban. Describe por qué crees que el ban debería ser levantado.'
                    )}
                  </p>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4" />
                    {tr('Seu recurso', 'Your appeal', 'Tu apelación')}
                  </label>
                  <textarea
                    value={appealReason}
                    onChange={(e) => setAppealReason(e.target.value)}
                    rows={5}
                    disabled={submitting}
                    placeholder={tr(
                      'Explique sua situação...',
                      'Explain your situation...',
                      'Explica tu situación...'
                    )}
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  </div>
                )}

                <button
                  onClick={submitAppeal}
                  disabled={submitting || !appealReason.trim()}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {tr('Enviar Recurso', 'Submit Appeal', 'Enviar Apelación')}
                </button>
              </>
            ) : (
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                    {tr('Recurso enviado', 'Appeal submitted', 'Apelación enviada')}
                  </p>
                </div>
                <p className="text-xs text-green-700 dark:text-green-400">
                  {tr(
                    'Seu recurso foi enviado e está aguardando revisão da administração. Você será notificado quando houver uma decisão.',
                    'Your appeal has been submitted and is awaiting admin review. You will be notified when there is a decision.',
                    'Tu apelación ha sido enviada y está esperando revisión. Serás notificado cuando haya una decisión.'
                  )}
                </p>
              </div>
            )}

            {/* Sign out */}
            <button
              onClick={signOut}
              className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
            >
              {tr('Sair da conta', 'Sign out', 'Cerrar sesión')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
