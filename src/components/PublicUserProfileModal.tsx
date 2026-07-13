import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, MessageCircle, Ban, CheckCircle, Calendar, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';
import { useAuth } from './AuthProvider';
import { OnlineBadge } from './OnlineBadge';
import { LevelBadge } from './LevelBadge';
import { ChatModal } from './ChatModal';

interface PublicUserProfileModalProps {
  userId: string;
  onClose: () => void;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  theme_color: string | null;
  profile_badge: string | null;
  created_at: string;
  role: string;
  last_seen_at: string | null;
  user_level: number | null;
  user_xp: number | null;
  seller_level: number | null;
  seller_xp: number | null;
  seller_slug: string | null;
}

export function PublicUserProfileModal({ userId, onClose }: PublicUserProfileModalProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    loadProfile();
    checkBlockStatus();
  }, [userId]);

  async function loadProfile() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, cover_url, bio, theme_color, profile_badge, created_at, role, last_seen_at, user_level, user_xp, seller_level, seller_xp, seller_slug')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  }

  async function checkBlockStatus() {
    if (!user || !userId) return;
    const { data } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', userId)
      .maybeSingle();
    setIsBlocked(!!data);
  }

  async function toggleBlock() {
    if (!user || !userId || blockLoading) return;
    setBlockLoading(true);
    try {
      if (isBlocked) {
        await supabase
          .from('blocked_users')
          .delete()
          .eq('blocker_id', user.id)
          .eq('blocked_id', userId);
        setIsBlocked(false);
      } else {
        await supabase
          .from('blocked_users')
          .insert({ blocker_id: user.id, blocked_id: userId });
        setIsBlocked(true);
      }
    } catch (err) {
      console.error('Error toggling block:', err);
    } finally {
      setBlockLoading(false);
    }
  }

  const themeColor = profile?.theme_color || '#3b82f6';
  const isSelf = user?.id === userId;

  const t = (pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : profile ? (
          <>
            {/* Cover */}
            <div
              className="h-24 relative"
              style={{ background: profile.cover_url ? `url(${profile.cover_url}) center/cover` : `linear-gradient(135deg, ${themeColor}dd, ${themeColor}77)` }}
            >
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Avatar + name */}
            <div className="px-6 pb-6 -mt-10">
              <div className="flex items-end justify-between mb-3">
                <div
                  className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white dark:border-gray-900 shadow-lg flex items-center justify-center"
                  style={{ backgroundColor: `${themeColor}33` }}
                >
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-8 w-8" style={{ color: themeColor }} />
                  )}
                </div>
                {profile.profile_badge && (
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> {profile.profile_badge}
                  </span>
                )}
              </div>

              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {profile.full_name || t('Usuário', 'User', 'Usuario')}
              </h2>

              <div className="flex items-center gap-3 mt-1.5">
                <OnlineBadge lastSeenAt={profile.last_seen_at} language={language} showLabel size="sm" />
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {t('Membro desde', 'Member since', 'Miembro desde')} {new Date(profile.created_at).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', { month: 'short', year: 'numeric' })}
                </span>
              </div>

              {/* Level badges */}
              <div className="flex items-center gap-2 mt-3">
                <LevelBadge level={profile.user_level || 0} type="user" size="sm" />
                {(profile.role === 'seller' || profile.role === 'admin') && (
                  <LevelBadge level={profile.seller_level || 0} type="seller" size="sm" />
                )}
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-4 leading-relaxed">
                  {profile.bio}
                </p>
              )}

              {/* Role badge */}
              <div className="mt-3">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                  profile.role === 'admin' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                  profile.role === 'seller' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                  'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}>
                  {profile.role === 'admin' ? t('Administrador', 'Administrator', 'Administrador') :
                   profile.role === 'seller' ? t('Vendedor', 'Seller', 'Vendedor') :
                   t('Membro', 'Member', 'Miembro')}
                </span>
              </div>

              {/* Actions */}
              {!isSelf && (
                <div className="flex items-center gap-2 mt-5">
                  <button
                    onClick={() => setChatOpen(true)}
                    disabled={isBlocked}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ backgroundColor: themeColor }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    {t('Conversar', 'Chat', 'Chatear')}
                  </button>
                  <button
                    onClick={toggleBlock}
                    disabled={blockLoading}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                      isBlocked
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                    }`}
                  >
                    {isBlocked ? (
                      <><CheckCircle className="h-4 w-4" /> {t('Desbloquear', 'Unblock', 'Desbloquear')}</>
                    ) : (
                      <><Ban className="h-4 w-4" /> {t('Bloquear', 'Block', 'Bloquear')}</>
                    )}
                  </button>
                </div>
              )}

              {isBlocked && !isSelf && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center">
                  {t('Você bloqueou este usuário. Desbloqueie para conversar.', 'You blocked this user. Unblock to chat.', 'Bloqueaste a este usuario. Desbloquea para chatear.')}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <User className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('Perfil não encontrado', 'Profile not found', 'Perfil no encontrado')}
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              {t('Fechar', 'Close', 'Cerrar')}
            </button>
          </div>
        )}
      </div>

      {chatOpen && profile && createPortal(
        <ChatModal
          otherUserId={profile.id}
          onClose={() => setChatOpen(false)}
        />,
        document.body
      )}
    </div>,
    document.body
  );
}
