import React, { useState, useEffect } from 'react';
import { Gavel, CheckCircle, XCircle, Loader, Clock, User, Mail, Ban, MessageSquare, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { AdminAPI } from '../lib/adminApi';

interface AppealWithUser {
  id: string;
  user_id: string;
  appeal_reason: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_response: string | null;
  reviewed_at: string | null;
  created_at: string;
  ban_reason_snapshot: string | null;
  user_email: string;
  user_name: string | null;
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

export default function AdminAppealsManager() {
  const { language } = useLanguage();
  const [appeals, setAppeals] = useState<AppealWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [reviewModal, setReviewModal] = useState<AppealWithUser | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const tr = (pt: string, en: string, es: string) => language === 'pt' ? pt : language === 'en' ? en : es;

  useEffect(() => {
    fetchAppeals();
  }, []);

  async function fetchAppeals() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ban_appeals')
        .select(`
          id, user_id, appeal_reason, status, admin_response, reviewed_at, created_at, ban_reason_snapshot,
          user:profiles!ban_appeals_user_id_fkey(email, full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const enriched: AppealWithUser[] = (data || []).map((a: any) => ({
        id: a.id,
        user_id: a.user_id,
        appeal_reason: a.appeal_reason,
        status: a.status,
        admin_response: a.admin_response,
        reviewed_at: a.reviewed_at,
        created_at: a.created_at,
        ban_reason_snapshot: a.ban_reason_snapshot,
        user_email: a.user?.email || '—',
        user_name: a.user?.full_name || null,
      }));

      setAppeals(enriched);
    } catch (error) {
      console.error('Error fetching appeals:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(decision: 'approved' | 'rejected') {
    if (!reviewModal) return;
    setActionLoading(true);
    try {
      await AdminAPI.reviewAppeal(reviewModal.user_id, reviewModal.id, decision, adminResponse);
      setReviewModal(null);
      setAdminResponse('');
      await fetchAppeals();
    } catch (error: any) {
      alert(error.message || tr('Erro ao avaliar recurso', 'Error reviewing appeal', 'Error al revisar'));
    } finally {
      setActionLoading(false);
    }
  }

  const filtered = filter === 'all' ? appeals : appeals.filter(a => a.status === filter);

  const pendingCount = appeals.filter(a => a.status === 'pending').length;
  const approvedCount = appeals.filter(a => a.status === 'approved').length;
  const rejectedCount = appeals.filter(a => a.status === 'rejected').length;

  const formatDateTime = (s: string | null) => {
    if (!s) return '—';
    return new Date(s).toLocaleString(language === 'pt' ? 'pt-BR' : language === 'en' ? 'en-US' : 'es-ES');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Gavel className="w-6 h-6 text-rose-600" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{tr('Recursos de Banimento', 'Ban Appeals', 'Apelaciones de Ban')}</h2>
        {pendingCount > 0 && (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
            {pendingCount} {tr('pendentes', 'pending', 'pendientes')}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{tr('Pendentes', 'Pending', 'Pendientes')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{tr('Aprovados', 'Approved', 'Aprobados')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{approvedCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{tr('Rejeitados', 'Rejected', 'Rechazados')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{rejectedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['pending', 'all', 'approved', 'rejected'] as FilterStatus[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {f === 'pending' ? tr('Pendentes', 'Pending', 'Pendientes') :
             f === 'all' ? tr('Todos', 'All', 'Todos') :
             f === 'approved' ? tr('Aprovados', 'Approved', 'Aprobados') :
             tr('Rejeitados', 'Rejected', 'Rechazados')}
          </button>
        ))}
      </div>

      {/* Appeals list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Gavel className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{tr('Nenhum recurso encontrado', 'No appeals found', 'Sin apelaciones')}</p>
          </div>
        ) : (
          filtered.map(appeal => (
            <div key={appeal.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-4 sm:p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center flex-shrink-0">
                      <Ban className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{appeal.user_name || tr('Sem nome', 'No name', 'Sin nombre')}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1"><Mail className="w-3 h-3" />{appeal.user_email}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                    appeal.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    appeal.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {appeal.status === 'pending' ? <><Clock className="w-3 h-3 mr-1" />{tr('Pendente', 'Pending', 'Pendiente')}</> :
                     appeal.status === 'approved' ? <><CheckCircle className="w-3 h-3 mr-1" />{tr('Aprovado', 'Approved', 'Aprobado')}</> :
                     <><XCircle className="w-3 h-3 mr-1" />{tr('Rejeitado', 'Rejected', 'Rechazado')}</>}
                  </span>
                </div>

                {/* Ban reason snapshot */}
                {appeal.ban_reason_snapshot && (
                  <div className="mb-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
                    <p className="text-xs text-red-700 dark:text-red-300"><span className="font-semibold">{tr('Motivo do ban:', 'Ban reason:', 'Razón del ban:')}</span> {appeal.ban_reason_snapshot}</p>
                  </div>
                )}

                {/* Appeal reason */}
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><MessageSquare className="w-3 h-3" />{tr('Recurso:', 'Appeal:', 'Apelación:')}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{appeal.appeal_reason}</p>
                </div>

                {/* Admin response (if reviewed) */}
                {appeal.admin_response && (
                  <div className="mb-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{tr('Resposta do admin:', 'Admin response:', 'Respuesta del admin:')}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{appeal.admin_response}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDateTime(appeal.reviewed_at)}</p>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-400">{formatDateTime(appeal.created_at)}</span>
                  {appeal.status === 'pending' && (
                    <button
                      onClick={() => { setReviewModal(appeal); setAdminResponse(''); }}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      {tr('Avaliar', 'Review', 'Revisar')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Gavel className="w-6 h-6 text-blue-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{tr('Avaliar Recurso', 'Review Appeal', 'Revisar Apelación')}</h3>
              </div>
              <button onClick={() => setReviewModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 mb-1">{tr('Usuário:', 'User:', 'Usuario:')}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{reviewModal.user_name || reviewModal.user_email}</p>
                {reviewModal.ban_reason_snapshot && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-2"><span className="font-semibold">{tr('Motivo do ban:', 'Ban reason:', 'Razón del ban:')}</span> {reviewModal.ban_reason_snapshot}</p>
                )}
                <p className="text-xs text-gray-500 mt-2 mb-1">{tr('Recurso:', 'Appeal:', 'Apelación:')}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{reviewModal.appeal_reason}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{tr('Resposta do admin', 'Admin response', 'Respuesta del admin')}</label>
                <textarea
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  rows={3}
                  placeholder={tr('Descreva sua decisão...', 'Describe your decision...', 'Describe tu decisión...')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">{tr('Aprovar irá desbanir o usuário. Rejeitar mantém o banimento.', 'Approving will unban the user. Rejecting keeps the ban.', 'Aprobar desbaneará al usuario. Rechazar mantiene el ban.')}</p>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setReviewModal(null)} disabled={actionLoading} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50">{tr('Cancelar', 'Cancel', 'Cancelar')}</button>
                <button onClick={() => handleReview('rejected')} disabled={actionLoading} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50">
                  {actionLoading ? <Loader className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  {tr('Rejeitar', 'Reject', 'Rechazar')}
                </button>
                <button onClick={() => handleReview('approved')} disabled={actionLoading} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50">
                  {actionLoading ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {tr('Aprovar', 'Approve', 'Aprobar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
