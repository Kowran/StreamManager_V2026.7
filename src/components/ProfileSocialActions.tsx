import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, UserCheck, Flag, X, Search, User, AlertCircle,
  CheckCircle, ArrowLeft, Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

export type ReportReason = 'scam' | 'fake_profile' | 'inappropriate_content' | 'spam' | 'harassment' | 'illegal_goods' | 'other';

interface FollowerUser {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string;
  followed_at: string;
}

const REASON_LABELS: Record<ReportReason, { pt: string; en: string; es: string; icon: string }> = {
  scam: { pt: 'Golpe / Fraude', en: 'Scam / Fraud', es: 'Estafa / Fraude', icon: '🚫' },
  fake_profile: { pt: 'Perfil falso', en: 'Fake profile', es: 'Perfil falso', icon: '🎭' },
  inappropriate_content: { pt: 'Conteúdo inapropriado', en: 'Inappropriate content', es: 'Contenido inapropiado', icon: '⚠️' },
  spam: { pt: 'Spam', en: 'Spam', es: 'Spam', icon: '📨' },
  harassment: { pt: 'Assédio', en: 'Harassment', es: 'Acoso', icon: '😡' },
  illegal_goods: { pt: 'Produtos ilegais', en: 'Illegal goods', es: 'Productos ilegales', icon: '🏴' },
  other: { pt: 'Outro', en: 'Other', es: 'Otro', icon: '❓' },
};

export function useFollow(targetUserId: string | null | undefined) {
  const { user } = useAuth();
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!targetUserId) return;
    const { count: fCount } = await supabase
      .from('profile_followers')
      .select('*', { count: 'exact', head: true })
      .eq('followed_id', targetUserId);
    setFollowersCount(fCount || 0);

    const { count: fgCount } = await supabase
      .from('profile_followers')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', targetUserId);
    setFollowingCount(fgCount || 0);

    if (user && user.id !== targetUserId) {
      const { data } = await supabase
        .from('profile_followers')
        .select('follower_id')
        .eq('follower_id', user.id)
        .eq('followed_id', targetUserId)
        .maybeSingle();
      setIsFollowing(!!data);
    }
  }, [targetUserId, user]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = useCallback(async () => {
    if (!user || !targetUserId || user.id === targetUserId || loading) return;
    setLoading(true);
    try {
      if (isFollowing) {
        await supabase
          .from('profile_followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('followed_id', targetUserId);
        setIsFollowing(false);
        setFollowersCount(c => Math.max(0, c - 1));
      } else {
        await supabase
          .from('profile_followers')
          .insert({ follower_id: user.id, followed_id: targetUserId });
        setIsFollowing(true);
        setFollowersCount(c => c + 1);
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    } finally {
      setLoading(false);
    }
  }, [user, targetUserId, isFollowing, loading]);

  return { followersCount, followingCount, isFollowing, loading, toggleFollow, reload: load };
}

interface FollowButtonProps {
  targetUserId: string;
  themeColor: string;
  variant?: 'full' | 'compact';
}

export function FollowButton({ targetUserId, themeColor, variant = 'full' }: FollowButtonProps) {
  const { user } = useAuth();
  const { isFollowing, loading, toggleFollow } = useFollow(targetUserId);
  const { language } = useLanguage();
  const lbl = (pt: string, en: string, es: string) => language === 'pt' ? pt : language === 'en' ? en : es;

  if (!user || user.id === targetUserId) return null;

  if (variant === 'compact') {
    return (
      <button
        onClick={toggleFollow}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-xl border transition-all disabled:opacity-50 ${
          isFollowing
            ? 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            : 'text-white border-transparent shadow-sm hover:shadow-md hover:-translate-y-0.5'
        }`}
        style={isFollowing ? {} : { background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}
      >
        {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        {isFollowing ? lbl('Seguindo', 'Following', 'Siguiendo') : lbl('Seguir', 'Follow', 'Seguir')}
      </button>
    );
  }

  return (
    <button
      onClick={toggleFollow}
      disabled={loading}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-50 ${
        isFollowing
          ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          : 'text-white hover:opacity-90'
      }`}
      style={isFollowing ? {} : { backgroundColor: themeColor }}
    >
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
      ) : isFollowing ? (
        <UserCheck className="h-4 w-4" />
      ) : (
        <UserPlus className="h-4 w-4" />
      )}
      {isFollowing ? lbl('Seguindo', 'Following', 'Siguiendo') : lbl('Seguir', 'Follow', 'Seguir')}
    </button>
  );
}

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  mode: 'followers' | 'following';
  themeColor: string;
}

export function FollowersModal({ isOpen, onClose, targetUserId, mode, themeColor }: FollowersModalProps) {
  const { language } = useLanguage();
  const [users, setUsers] = useState<FollowerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const lbl = (pt: string, en: string, es: string) => language === 'pt' ? pt : language === 'en' ? en : es;

  useEffect(() => {
    if (!isOpen) return;
    loadUsers();
  }, [isOpen, targetUserId, mode]);

  async function loadUsers() {
    setLoading(true);
    try {
      const column = mode === 'followers' ? 'follower_id' : 'followed_id';
      const { data: rels, error } = await supabase
        .from('profile_followers')
        .select(`${column}, created_at`)
        .eq(mode === 'followers' ? 'followed_id' : 'follower_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!rels || rels.length === 0) { setUsers([]); return; }

      const ids = rels.map((r: any) => r[column]) as string[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, role')
        .in('id', ids);

      const map = new Map((profiles || []).map(p => [p.id, p]));
      setUsers(rels.map((r: any) => ({
        id: r[column],
        followed_at: r.created_at,
        full_name: map.get(r[column])?.full_name || null,
        username: map.get(r[column])?.username || null,
        avatar_url: map.get(r[column])?.avatar_url || null,
        role: map.get(r[column])?.role || 'customer',
      })));
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.full_name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
  });

  if (!isOpen) return null;

  const title = mode === 'followers'
    ? lbl('Seguidores', 'Followers', 'Seguidores')
    : lbl('Seguindo', 'Following', 'Siguiendo');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${themeColor}1a`, color: themeColor }}>
              <Users className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{users.length}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        {users.length > 0 && (
          <div className="p-3 border-b border-gray-100 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={lbl('Buscar...', 'Search...', 'Buscar...')}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent" style={{ borderColor: themeColor }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <Users className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {users.length === 0
                  ? (mode === 'followers' ? lbl('Nenhum seguidor ainda', 'No followers yet', 'Sin seguidores aún') : lbl('Não segue ninguém', 'Not following anyone', 'No sigue a nadie'))
                  : lbl('Nenhum resultado', 'No results', 'Sin resultados')}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map(u => (
                <button
                  key={u.id}
                  onClick={() => {
                    const ident = u.username || u.id;
                    window.location.href = `/user/${ident}`;
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}aa)` }}>
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-sm">{(u.full_name || 'U').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.full_name || lbl('Usuário', 'User', 'Usuario')}</p>
                    {u.username && <p className="text-xs text-gray-400 truncate">@{u.username}</p>}
                  </div>
                  {u.role === 'seller' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                      {lbl('Vendedor', 'Seller', 'Vendedor')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface FollowersStatsProps {
  targetUserId: string;
  themeColor: string;
  onOpen: (mode: 'followers' | 'following') => void;
}

export function FollowersStats({ targetUserId, themeColor, onOpen }: FollowersStatsProps) {
  const { followersCount, followingCount } = useFollow(targetUserId);
  const { language } = useLanguage();
  const lbl = (pt: string, en: string, es: string) => language === 'pt' ? pt : language === 'en' ? en : es;

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => onOpen('followers')}
        className="flex flex-col items-center group hover:opacity-80 transition-opacity"
      >
        <span className="text-lg font-bold text-gray-900 dark:text-white">{followersCount}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300">{lbl('Seguidores', 'Followers', 'Seguidores')}</span>
      </button>
      <div className="h-8 w-px bg-gray-200 dark:bg-gray-600" />
      <button
        onClick={() => onOpen('following')}
        className="flex flex-col items-center group hover:opacity-80 transition-opacity"
      >
        <span className="text-lg font-bold text-gray-900 dark:text-white">{followingCount}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300">{lbl('Seguindo', 'Following', 'Siguiendo')}</span>
      </button>
    </div>
  );
}

interface ReportProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUserName: string;
}

export function ReportProfileModal({ isOpen, onClose, targetUserId, targetUserName }: ReportProfileModalProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [existingReport, setExistingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lbl = (pt: string, en: string, es: string) => language === 'pt' ? pt : language === 'en' ? en : es;

  useEffect(() => {
    if (!isOpen) {
      setReason(null);
      setDescription('');
      setSubmitted(false);
      setError(null);
      return;
    }
    checkExisting();
  }, [isOpen]);

  async function checkExisting() {
    if (!user) return;
    const { data } = await supabase
      .from('profile_reports')
      .select('id, status')
      .eq('reporter_id', user.id)
      .eq('reported_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data && data.status !== 'dismissed') {
      setExistingReport(true);
    }
  }

  async function handleSubmit() {
    if (!user || !reason) return;
    setError(null);
    if (description.length > 500) {
      setError(lbl('Descrição muito longa (máx 500 caracteres)', 'Description too long (max 500 chars)', 'Descripción demasiado larga (máx 500 caracteres)'));
      return;
    }
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase
        .from('profile_reports')
        .insert({
          reporter_id: user.id,
          reported_id: targetUserId,
          reason,
          description: description.trim() || null,
        });
      if (insertError) throw insertError;
      setSubmitted(true);
      setExistingReport(true);
    } catch (err) {
      console.error('Error submitting report:', err);
      setError(lbl('Erro ao enviar denúncia. Tente novamente.', 'Error submitting report. Try again.', 'Error al enviar denuncia. Inténtalo de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
              <Flag className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {lbl('Denunciar Perfil', 'Report Profile', 'Denunciar Perfil')}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {submitted ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                {lbl('Denúncia enviada!', 'Report submitted!', '¡Denuncia enviada!')}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {lbl('Nossa equipe irá analisar sua denúncia em breve.', 'Our team will review your report soon.', 'Nuestro equipo revisará tu denuncia pronto.')}
              </p>
              <button
                onClick={onClose}
                className="mt-5 px-5 py-2 text-sm font-medium text-white rounded-xl bg-green-600 hover:bg-green-700 transition-colors"
              >
                {lbl('Fechar', 'Close', 'Cerrar')}
              </button>
            </div>
          ) : existingReport ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
                <AlertCircle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                {lbl('Você já denunciou este perfil', 'You already reported this profile', 'Ya has denunciado este perfil')}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {lbl('Sua denúncia está sendo analisada. Não é necessário enviar outra.', 'Your report is being reviewed. No need to submit another.', 'Tu denuncia está siendo revisada. No es necesario enviar otra.')}
              </p>
              <button
                onClick={onClose}
                className="mt-5 px-5 py-2 text-sm font-medium text-white rounded-xl bg-gray-600 hover:bg-gray-700 transition-colors"
              >
                {lbl('Fechar', 'Close', 'Cerrar')}
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                {lbl('Você está denunciando', 'You are reporting', 'Estás denunciando')}
              </p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-4">@{targetUserName}</p>

              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                {lbl('Motivo da denúncia', 'Report reason', 'Motivo de la denuncia')}
              </label>
              <div className="grid grid-cols-1 gap-2 mb-4">
                {(Object.keys(REASON_LABELS) as ReportReason[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${
                      reason === r
                        ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                        : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <span className="text-base">{REASON_LABELS[r].icon}</span>
                    <span>{lbl(REASON_LABELS[r].pt, REASON_LABELS[r].en, REASON_LABELS[r].es)}</span>
                    {reason === r && <CheckCircle className="h-4 w-4 ml-auto" />}
                  </button>
                ))}
              </div>

              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                {lbl('Detalhes (opcional)', 'Details (optional)', 'Detalles (opcional)')}
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder={lbl('Descreva o problema...', 'Describe the issue...', 'Describe el problema...')}
                className="w-full text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-red-400 resize-none"
              />
              <p className="text-xs text-gray-400 text-right mt-0.5">{description.length}/500</p>

              {error && (
                <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
                </div>
              )}

              <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {lbl(
                    'Denúncias falsas podem resultar em suspensão da sua conta. Use com responsabilidade.',
                    'False reports may result in account suspension. Use responsibly.',
                    'Denuncias falsas pueden resultar en suspensión de tu cuenta. Úsalo con responsabilidad.'
                  )}
                </p>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {lbl('Cancelar', 'Cancel', 'Cancelar')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!reason || submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <Flag className="h-4 w-4" />
                  )}
                  {lbl('Enviar Denúncia', 'Submit Report', 'Enviar Denuncia')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface ReportButtonProps {
  targetUserId: string;
  targetUserName: string;
  variant?: 'full' | 'icon';
}

export function ReportButton({ targetUserId, targetUserName, variant = 'icon' }: ReportButtonProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const lbl = (pt: string, en: string, es: string) => language === 'pt' ? pt : language === 'en' ? en : es;

  if (!user || user.id === targetUserId) return null;

  return (
    <>
      {variant === 'icon' ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 transition-colors"
          title={lbl('Denunciar', 'Report', 'Denunciar')}
        >
          <Flag className="h-4 w-4" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 transition-colors text-sm font-medium"
        >
          <Flag className="h-4 w-4" />
          {lbl('Denunciar', 'Report', 'Denunciar')}
        </button>
      )}
      <ReportProfileModal
        isOpen={open}
        onClose={() => setOpen(false)}
        targetUserId={targetUserId}
        targetUserName={targetUserName}
      />
    </>
  );
}
