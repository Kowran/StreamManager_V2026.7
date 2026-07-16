import React, { useState, useEffect, useRef } from 'react';
import {
  User, Save, X, Mail, Globe, Shield, Check, AlertCircle, Camera, Store,
  Bell, BellOff, CreditCard as Edit3, Palette, Sparkles, ImagePlus, Trash2,
  Star, ShoppingBag, MessageCircle, Ban, CheckCircle, Calendar, ArrowLeft,
  Share2, Copy,
} from 'lucide-react';
import { supabase, hasAccountsAccess } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useNotificationContext } from './NotificationProvider';
import { OnlineBadge } from './OnlineBadge';
import { LevelBadge, LevelProgressBar } from './LevelBadge';
import { PasswordChangeModal } from './PasswordChangeModal';
import { SellerRequestForm } from './SellerRequestForm';
import { ChatModal } from './ChatModal';

interface ProfileData {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  language: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  theme_color: string | null;
  profile_badge: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  login_count: number;
  last_seen_at: string | null;
  hide_expiring_balloon?: boolean;
  username?: string | null;
  seller_slug?: string | null;
  user_level?: number | null;
  user_xp?: number | null;
  seller_level?: number | null;
  seller_xp?: number | null;
}

interface PublicProfilePageProps {
  identifier: string;
  onBack: () => void;
  onNavigate?: (tab: string) => void;
}

const THEME_COLORS = [
  { label: 'Azul', value: '#3b82f6' },
  { label: 'Esmeralda', value: '#10b981' },
  { label: 'Rosa', value: '#ec4899' },
  { label: 'Âmbar', value: '#f59e0b' },
  { label: 'Vermelho', value: '#ef4444' },
  { label: 'Ciano', value: '#06b6d4' },
  { label: 'Laranja', value: '#f97316' },
  { label: 'Cinza', value: '#6b7280' },
];

const BADGES = [
  { label: 'Nenhum', value: '' },
  { label: '⭐ VIP', value: '⭐ VIP' },
  { label: '🔥 Ativo', value: '🔥 Ativo' },
  { label: '💎 Premium', value: '💎 Premium' },
  { label: '🚀 Early Bird', value: '🚀 Early Bird' },
  { label: '🌟 Top Fan', value: '🌟 Top Fan' },
  { label: '🎯 Pro', value: '🎯 Pro' },
];

export function PublicProfilePage({ identifier, onBack, onNavigate }: PublicProfilePageProps) {
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { addNotification } = useNotificationContext();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state (only for self)
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSellerRequestForm, setShowSellerRequestForm] = useState(false);
  const [hasRequestedSeller, setHasRequestedSeller] = useState(false);
  const [hasStreamingAccess, setHasStreamingAccess] = useState(false);
  const [hideExpiringBalloon, setHideExpiringBalloon] = useState(false);
  const [savingBalloonPref, setSavingBalloonPref] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'appearance' | 'security' | 'reviews'>('info');
  const [sellerReviews, setSellerReviews] = useState<any[]>([]);
  const [customerReviews, setCustomerReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Public-only state
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    language: 'pt',
    bio: '',
    theme_color: '#3b82f6',
    profile_badge: '',
  });

  const isSelf = user?.id === profile?.id;

  useEffect(() => {
    loadProfile();
  }, [identifier]);

  useEffect(() => {
    if (profile && isSelf) {
      checkSellerRequest();
      checkStreamingAccess();
    }
  }, [profile, isSelf]);

  useEffect(() => {
    if (profile && isSelf && activeTab === 'reviews') {
      loadUserRatings(profile.id);
    }
  }, [profile, isSelf, activeTab]);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        language: profile.language || 'pt',
        bio: profile.bio || '',
        theme_color: profile.theme_color || '#3b82f6',
        profile_badge: profile.profile_badge || '',
      });
      setHideExpiringBalloon(profile.hide_expiring_balloon || false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile && user && !isSelf) {
      checkBlockStatus();
    }
  }, [profile, user, isSelf]);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      // Try by username first, then by ID
      let query = supabase.from('profiles').select('*');

      // Check if identifier looks like a UUID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      if (isUuid) {
        query = query.eq('id', identifier);
      } else {
        query = query.eq('username', identifier);
      }

      const { data, error: queryError } = await query.maybeSingle();

      if (queryError) throw queryError;
      if (!data) {
        setError(language === 'pt' ? 'Perfil não encontrado' : language === 'en' ? 'Profile not found' : 'Perfil no encontrado');
        return;
      }

      setProfile(data);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError(language === 'pt' ? 'Erro ao carregar perfil' : language === 'en' ? 'Error loading profile' : 'Error al cargar perfil');
    } finally {
      setLoading(false);
    }
  }

  async function checkBlockStatus() {
    if (!user || !profile) return;
    const { data } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', profile.id)
      .maybeSingle();
    setIsBlocked(!!data);
  }

  async function toggleBlock() {
    if (!user || !profile || blockLoading) return;
    setBlockLoading(true);
    try {
      if (isBlocked) {
        await supabase.from('blocked_users').delete().eq('blocker_id', user.id).eq('blocked_id', profile.id);
        setIsBlocked(false);
      } else {
        await supabase.from('blocked_users').insert({ blocker_id: user.id, blocked_id: profile.id });
        setIsBlocked(true);
      }
    } catch (err) {
      console.error('Error toggling block:', err);
    } finally {
      setBlockLoading(false);
    }
  }

  async function checkStreamingAccess() {
    if (!user) return;
    try {
      const access = await hasAccountsAccess(user.id);
      setHasStreamingAccess(access);
    } catch {
      setHasStreamingAccess(false);
    }
  }

  async function checkSellerRequest() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('seller_requests')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setHasRequestedSeller(!!data);
    } catch (err) {
      console.error('Error checking seller request:', err);
    }
  }

  async function loadUserRatings(profileId: string) {
    setReviewsLoading(true);
    try {
      const { data: asSeller } = await supabase
        .from('user_ratings')
        .select('id, rating, comment, created_at, rater_role, profiles!user_ratings_rater_id_fkey(full_name)')
        .eq('rated_user_id', profileId)
        .eq('rater_role', 'customer')
        .order('created_at', { ascending: false })
        .limit(20);
      setSellerReviews(asSeller || []);

      const { data: asCustomer } = await supabase
        .from('user_ratings')
        .select('id, rating, comment, created_at, rater_role, profiles!user_ratings_rater_id_fkey(full_name)')
        .eq('rated_user_id', profileId)
        .eq('rater_role', 'seller')
        .order('created_at', { ascending: false })
        .limit(20);
      setCustomerReviews(asCustomer || []);
    } catch (err) {
      console.error('Error loading user ratings:', err);
    } finally {
      setReviewsLoading(false);
    }
  }

  async function uploadImage(
    file: File,
    bucket: 'avatars' | 'covers',
    setUploading: (v: boolean) => void
  ): Promise<string | null> {
    if (!user) return null;
    if (!file.type.startsWith('image/')) {
      setError('Apenas imagens são permitidas');
      return null;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 2MB');
      return null;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      console.error(`Error uploading to ${bucket}:`, err);
      setError('Erro ao fazer upload da imagem');
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !profile) return;
    const url = await uploadImage(file, 'avatars', setUploadingAvatar);
    if (url) {
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
      setProfile(prev => prev ? { ...prev, avatar_url: url } : prev);
    }
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !profile) return;
    const url = await uploadImage(file, 'covers', setUploadingCover);
    if (url) {
      await supabase.from('profiles').update({ cover_url: url }).eq('id', user.id);
      setProfile(prev => prev ? { ...prev, cover_url: url } : prev);
    }
  }

  async function removeCover() {
    if (!user || !profile) return;
    await supabase.from('profiles').update({ cover_url: null }).eq('id', user.id);
    setProfile(prev => prev ? { ...prev, cover_url: null } : prev);
  }

  async function removeAvatar() {
    if (!user || !profile) return;
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
    setProfile(prev => prev ? { ...prev, avatar_url: null } : prev);
  }

  async function handleSave() {
    if (!user || !profile) return;
    setSaving(true);
    setError(null);
    try {
      if (!formData.full_name.trim()) throw new Error('Nome completo é obrigatório');
      if (formData.bio.length > 200) throw new Error('Bio deve ter no máximo 200 caracteres');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim(),
          language: formData.language,
          bio: formData.bio.trim() || null,
          theme_color: formData.theme_color,
          profile_badge: formData.profile_badge || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      if (formData.language !== language) {
        setLanguage(formData.language as any);
      }

      await loadProfile();
      setSuccess(true);
      setEditing(false);

      await addNotification({
        type: 'system',
        title: 'Perfil Atualizado',
        message: 'Suas informações foram atualizadas com sucesso!',
        data: { action: 'profile_updated' },
        priority: 'low',
      });

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  }

  async function toggleExpiringBalloon() {
    if (!user) return;
    setSavingBalloonPref(true);
    try {
      const newValue = !hideExpiringBalloon;
      const { error } = await supabase
        .from('profiles')
        .update({ hide_expiring_balloon: newValue })
        .eq('id', user.id);
      if (error) throw error;
      setHideExpiringBalloon(newValue);
    } catch (err) {
      console.error('Error updating balloon preference:', err);
    } finally {
      setSavingBalloonPref(false);
    }
  }

  function copyProfileLink() {
    const identifier = profile?.username || profile?.id;
    const url = `${window.location.origin}${window.location.pathname}#user/${identifier}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        language: profile.language || 'pt',
        bio: profile.bio || '',
        theme_color: profile.theme_color || '#3b82f6',
        profile_badge: profile.profile_badge || '',
      });
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return language === 'pt' ? 'Nunca' : 'Never';
    return new Date(dateString).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  function getRoleLabel(role: string) {
    const labels: Record<string, string> = {
      admin: language === 'pt' ? 'Administrador' : 'Administrator',
      customer: language === 'pt' ? 'Cliente' : 'Customer',
      seller: language === 'pt' ? 'Vendedor' : 'Seller',
    };
    return labels[role] || role;
  }

  const themeColor = profile?.theme_color || '#3b82f6';
  const lbl = (pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <User className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-base font-medium text-gray-700 dark:text-gray-300">
          {error || lbl('Perfil não encontrado', 'Profile not found', 'Perfil no encontrado')}
        </p>
        <button
          onClick={onBack}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {lbl('Voltar', 'Back', 'Volver')}
        </button>
      </div>
    );
  }

  const tabs = isSelf ? [
    { id: 'info' as const, label: lbl('Informações', 'Information', 'Información'), icon: User },
    { id: 'appearance' as const, label: lbl('Aparência', 'Appearance', 'Apariencia'), icon: Palette },
    { id: 'security' as const, label: lbl('Segurança', 'Security', 'Seguridad'), icon: Shield },
    { id: 'reviews' as const, label: lbl('Avaliações', 'Reviews', 'Reseñas'), icon: Star },
  ] : [];

  return (
    <div className="max-w-3xl mx-auto space-y-0">
      {/* Hidden file inputs (self only) */}
      {isSelf && (
        <>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverUpload} />
        </>
      )}

      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-3"
      >
        <ArrowLeft className="h-4 w-4" />
        {lbl('Voltar', 'Back', 'Volver')}
      </button>

      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">

        {/* Cover image area */}
        <div className="relative h-36 sm:h-48 group">
          {profile.cover_url ? (
            <img src={profile.cover_url} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(135deg, ${themeColor}33 0%, ${themeColor}88 50%, ${themeColor}55 100%)`,
              }}
            />
          )}
          {!profile.cover_url && (
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)`,
                backgroundSize: '40px 40px',
              }}
            />
          )}
          {/* Cover actions (self only) */}
          {isSelf && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
              <button
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-xs font-medium rounded-lg transition-colors backdrop-blur-sm"
              >
                {uploadingCover ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5" />
                )}
                {lbl('Trocar capa', 'Change cover', 'Cambiar portada')}
              </button>
              {profile.cover_url && (
                <button
                  onClick={removeCover}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/80 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors backdrop-blur-sm"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {lbl('Remover', 'Remove', 'Eliminar')}
                </button>
              )}
            </div>
          )}

          {/* Share button */}
          <button
            onClick={copyProfileLink}
            className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/40 hover:bg-black/60 text-white text-xs font-medium rounded-lg transition-colors backdrop-blur-sm"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
            {copied ? lbl('Copiado!', 'Copied!', '¡Copiado!') : lbl('Compartilhar', 'Share', 'Compartir')}
          </button>
        </div>

        {/* Avatar + name row */}
        <div className="px-6 pb-5">
          <div className="flex items-end justify-between -mt-10 mb-4">
            {/* Avatar */}
            <div className="relative group">
              <div
                className="w-20 h-20 rounded-2xl border-4 border-white dark:border-gray-800 shadow-lg overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}aa)` }}
              >
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-8 w-8 text-white" />
                  </div>
                )}
              </div>
              {/* Avatar overlay (self only) */}
              {isSelf && (
                <div className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 cursor-pointer"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {uploadingAvatar ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  ) : (
                    <Camera className="h-5 w-5 text-white" />
                  )}
                </div>
              )}
              {isSelf && profile.avatar_url && (
                <button
                  onClick={removeAvatar}
                  className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Edit button (self only) */}
            {isSelf && (
              !editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Edit3 className="h-4 w-4" />
                  {lbl('Editar', 'Edit', 'Editar')}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={cancelEdit}
                    className="flex items-center gap-1 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="h-4 w-4" />
                    {lbl('Cancelar', 'Cancel', 'Cancelar')}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-xl text-white transition-colors disabled:opacity-60"
                    style={{ backgroundColor: themeColor }}
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {saving ? lbl('Salvando...', 'Saving...', 'Guardando...') : lbl('Salvar', 'Save', 'Guardar')}
                  </button>
                </div>
              )
            )}
          </div>

          {/* Name + badge */}
          <div className="space-y-1">
            {editing ? (
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                className="text-xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-dashed border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none w-full pb-1"
                placeholder="Seu nome"
              />
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {profile.full_name || lbl('Usuário', 'User', 'Usuario')}
                </h2>
                {profile.profile_badge && (
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: themeColor }}
                  >
                    {profile.profile_badge}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  profile.role === 'admin'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    : profile.role === 'seller'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {profile.role === 'admin' && <Shield className="w-3 h-3 inline mr-1" />}
                  {getRoleLabel(profile.role)}
                </span>
              </div>
            )}

            {/* Email (self only) */}
            {isSelf && (
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {profile.email}
              </p>
            )}

            {/* Username display */}
            {profile.username && (
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <span className="text-gray-400">@</span>{profile.username}
              </p>
            )}

            {/* Level Badges */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {profile.user_level != null && (
                <LevelBadge level={profile.user_level} type="user" size="sm" showLabel />
              )}
              {(profile.role === 'seller' || profile.role === 'admin') && profile.seller_level != null && (
                <LevelBadge level={profile.seller_level} type="seller" size="sm" showLabel />
              )}
            </div>

            {/* Bio */}
            {editing ? (
              <div className="mt-2">
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  maxLength={200}
                  rows={2}
                  className="w-full text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-blue-400"
                  placeholder={lbl('Escreva algo sobre você...', 'Write something about yourself...', 'Escribe algo sobre ti...')}
                />
                <p className="text-xs text-gray-400 text-right mt-0.5">{formData.bio.length}/200</p>
              </div>
            ) : profile.bio ? (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic">"{profile.bio}"</p>
            ) : null}
          </div>
        </div>

        {/* Stats strip */}
        <div className="px-6 pb-5 grid grid-cols-3 gap-3">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-gray-900 dark:text-white">{profile.login_count || 0}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{lbl('Logins', 'Logins', 'Logins')}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
            <div className="text-xs font-semibold text-gray-900 dark:text-white">
              {formatDate(profile.created_at)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{lbl('Membro desde', 'Member since', 'Miembro desde')}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
            <div className="text-xs font-semibold text-gray-900 dark:text-white">
              {profile.last_login_at ? formatDate(profile.last_login_at) : '-'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{lbl('Último acesso', 'Last login', 'Último acceso')}</div>
          </div>
        </div>

        {/* Level Progress (self only) */}
        {isSelf && (
          <div className="px-6 pb-5 space-y-3">
            {profile.user_level != null && (
              <LevelProgressBar level={profile.user_level} xp={profile.user_xp || 0} type="user" language={language} />
            )}
            {(profile.role === 'seller' || profile.role === 'admin') && profile.seller_level != null && (
              <LevelProgressBar level={profile.seller_level} xp={profile.seller_xp || 0} type="seller" language={language} />
            )}
          </div>
        )}

        {/* Online status strip */}
        <div className="px-6 pb-5">
          <div className="flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl py-2.5">
            <OnlineBadge lastSeenAt={profile.last_seen_at} language={language} showLabel size="md" />
          </div>
        </div>

        {/* Public actions (not self) */}
        {!isSelf && user && (
          <div className="px-6 pb-5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setChatOpen(true)}
                disabled={isBlocked}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: themeColor }}
              >
                <MessageCircle className="h-4 w-4" />
                {lbl('Conversar', 'Chat', 'Chatear')}
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
                  <><CheckCircle className="h-4 w-4" /> {lbl('Desbloquear', 'Unblock', 'Desbloquear')}</>
                ) : (
                  <><Ban className="h-4 w-4" /> {lbl('Bloquear', 'Block', 'Bloquear')}</>
                )}
              </button>
            </div>
            {isBlocked && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center">
                {lbl('Você bloqueou este usuário. Desbloqueie para conversar.', 'You blocked this user. Unblock to chat.', 'Bloqueaste a este usuario. Desbloquea para chatear.')}
              </p>
            )}
          </div>
        )}

        {/* Visit store link for sellers */}
        {!isSelf && (profile.role === 'seller' || profile.role === 'admin') && profile.seller_slug && (
          <div className="px-6 pb-5">
            <button
              onClick={() => {
                window.location.hash = `#seller/${profile.seller_slug}`;
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white text-sm transition-all hover:opacity-90"
              style={{ backgroundColor: themeColor }}
            >
              <Store className="h-4 w-4" />
              {lbl('Ver Loja', 'View Store', 'Ver Tienda')}
            </button>
          </div>
        )}
      </div>

      {/* Feedback messages */}
      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-center gap-2 mt-3">
          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="text-sm text-emerald-700 dark:text-emerald-400">
            {lbl('Perfil atualizado com sucesso!', 'Profile updated successfully!', '¡Perfil actualizado con éxito!')}
          </span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-2 mt-3">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Tabs (self only) */}
      {isSelf && tabs.length > 0 && (
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex border-b border-gray-100 dark:border-gray-700">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                style={activeTab === tab.id ? { borderBottomColor: themeColor, color: themeColor } : {}}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* INFO TAB */}
            {activeTab === 'info' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                      {lbl('Nome completo', 'Full name', 'Nombre completo')}
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-400"
                      />
                    ) : (
                      <p className="text-sm text-gray-900 dark:text-white py-2">
                        {profile.full_name || <span className="text-gray-400">—</span>}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                      {lbl('Idioma', 'Language', 'Idioma')}
                    </label>
                    {editing ? (
                      <select
                        value={formData.language}
                        onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-400"
                      >
                        <option value="pt">Português (Brasil)</option>
                        <option value="en">English</option>
                        <option value="es">Español</option>
                      </select>
                    ) : (
                      <p className="text-sm text-gray-900 dark:text-white py-2 flex items-center gap-1.5">
                        <Globe className="h-4 w-4 text-gray-400" />
                        {profile.language === 'pt' ? 'Português (Brasil)' : profile.language === 'en' ? 'English' : 'Español'}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                      Email
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white py-2 flex items-center gap-1.5">
                      <Mail className="h-4 w-4 text-gray-400" />
                      {profile.email}
                      <span className="text-xs text-gray-400">({lbl('não editável', 'not editable', 'no editable')})</span>
                    </p>
                  </div>
                </div>

                {/* Account details */}
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {lbl('Detalhes da conta', 'Account details', 'Detalles de la cuenta')}
                  </h4>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">ID</span>
                    <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate max-w-[180px]">{profile.id}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">{lbl('Última atualização', 'Last update', 'Última actualización')}</span>
                    <span className="text-gray-700 dark:text-gray-300">{formatDate(profile.updated_at)}</span>
                  </div>
                </div>

                {/* Seller actions */}
                <div className="space-y-2">
                  {profile.role !== 'seller' && profile.role !== 'admin' && !hasRequestedSeller && (
                    <button
                      onClick={() => setShowSellerRequestForm(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors text-sm"
                    >
                      <Store className="h-4 w-4" />
                      {lbl('Solicitar permissão para vender', 'Request seller permission', 'Solicitar permiso para vender')}
                    </button>
                  )}
                  {profile.role === 'seller' && onNavigate && (
                    <button
                      onClick={() => onNavigate('seller-store')}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white font-medium rounded-xl transition-colors text-sm"
                      style={{ backgroundColor: themeColor }}
                    >
                      <Store className="h-4 w-4" />
                      {lbl('Minha Loja', 'My Store', 'Mi Tienda')}
                    </button>
                  )}
                  {hasRequestedSeller && profile.role !== 'seller' && profile.role !== 'admin' && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-center">
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        {lbl('Solicitação pendente de aprovação', 'Request pending approval', 'Solicitud pendiente de aprobación')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* APPEARANCE TAB */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {lbl('Cor do tema', 'Theme color', 'Color del tema')}
                    <span className="ml-2 text-xs normal-case font-normal text-gray-400">
                      {lbl('(visível para todos)', '(visible to everyone)', '(visible para todos)')}
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {THEME_COLORS.map(color => (
                      <button
                        key={color.value}
                        onClick={() => setFormData(prev => ({ ...prev, theme_color: color.value }))}
                        title={color.label}
                        className={`w-9 h-9 rounded-xl border-2 transition-transform hover:scale-110 ${
                          formData.theme_color === color.value
                            ? 'border-gray-900 dark:border-white scale-110 shadow-md'
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color.value }}
                      />
                    ))}
                    <label className="w-9 h-9 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors relative overflow-hidden">
                      <Sparkles className="h-4 w-4 text-gray-400" />
                      <input
                        type="color"
                        value={formData.theme_color}
                        onChange={(e) => setFormData(prev => ({ ...prev, theme_color: e.target.value }))}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: formData.theme_color }}>
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <div className="h-2 w-24 rounded-full" style={{ backgroundColor: formData.theme_color }} />
                      <div className="h-1.5 w-16 rounded-full mt-1.5" style={{ backgroundColor: `${formData.theme_color}66` }} />
                    </div>
                    <span className="text-xs text-gray-400 ml-auto">{lbl('Pré-visualização', 'Preview', 'Vista previa')}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {lbl('Badge do perfil', 'Profile badge', 'Insignia del perfil')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {BADGES.map(badge => (
                      <button
                        key={badge.value}
                        onClick={() => setFormData(prev => ({ ...prev, profile_badge: badge.value }))}
                        className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                          formData.profile_badge === badge.value
                            ? 'border-transparent text-white shadow-sm'
                            : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700/50'
                        }`}
                        style={formData.profile_badge === badge.value ? { backgroundColor: formData.theme_color } : {}}
                      >
                        {badge.label || lbl('Nenhum', 'None', 'Ninguno')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    {lbl('Imagem de capa', 'Cover image', 'Imagen de portada')}
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => coverInputRef.current?.click()}
                      disabled={uploadingCover}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-60"
                      style={{ backgroundColor: formData.theme_color }}
                    >
                      {uploadingCover ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      ) : (
                        <ImagePlus className="h-4 w-4" />
                      )}
                      {lbl('Fazer upload', 'Upload', 'Subir')}
                    </button>
                    {profile.cover_url && (
                      <button
                        onClick={removeCover}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                        {lbl('Remover capa', 'Remove cover', 'Eliminar portada')}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {lbl('JPG, PNG ou WebP. Máximo 2MB.', 'JPG, PNG, or WebP. Max 2MB.', 'JPG, PNG o WebP. Máx 2MB.')}
                  </p>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium transition-colors disabled:opacity-60"
                  style={{ backgroundColor: formData.theme_color }}
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? lbl('Salvando...', 'Saving...', 'Guardando...') : lbl('Aplicar aparência', 'Apply appearance', 'Aplicar apariencia')}
                </button>
              </div>
            )}

            {/* SECURITY TAB */}
            {activeTab === 'security' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                      <Shield className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {lbl('Alterar senha', 'Change password', 'Cambiar contraseña')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {lbl('Mantenha sua conta segura', 'Keep your account secure', 'Mantén tu cuenta segura')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="px-3 py-1.5 text-sm font-medium text-white rounded-xl transition-colors"
                    style={{ backgroundColor: themeColor }}
                  >
                    {lbl('Alterar', 'Change', 'Cambiar')}
                  </button>
                </div>

                {hasStreamingAccess && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        hideExpiringBalloon ? 'bg-gray-100 dark:bg-gray-700' : 'bg-orange-100 dark:bg-orange-900/30'
                      }`}>
                        {hideExpiringBalloon
                          ? <BellOff className="h-4 w-4 text-gray-500" />
                          : <Bell className="h-4 w-4 text-orange-500" />
                        }
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {lbl('Balão de contas vencidas', 'Expiring accounts balloon', 'Globo de cuentas vencidas')}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {lbl('Notificação flutuante', 'Floating notification', 'Notificación flotante')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={toggleExpiringBalloon}
                      disabled={savingBalloonPref}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        hideExpiringBalloon ? 'bg-gray-300 dark:bg-gray-600' : 'bg-blue-600'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        hideExpiringBalloon ? 'translate-x-1' : 'translate-x-6'
                      }`} />
                    </button>
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide mb-2">
                    {lbl('Dicas de segurança', 'Security tips', 'Consejos de seguridad')}
                  </h4>
                  <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1.5">
                    <li className="flex items-start gap-1.5">
                      <Check className="h-3 w-3 mt-0.5 shrink-0" />
                      {lbl('Use uma senha única e forte', 'Use a unique, strong password', 'Usa una contraseña única y fuerte')}
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Check className="h-3 w-3 mt-0.5 shrink-0" />
                      {lbl('Não compartilhe suas credenciais', "Don't share your credentials", 'No compartas tus credenciales')}
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Check className="h-3 w-3 mt-0.5 shrink-0" />
                      {lbl('Saia em dispositivos compartilhados', 'Log out on shared devices', 'Sal en dispositivos compartidos')}
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* REVIEWS TAB */}
            {activeTab === 'reviews' && (
              <div className="space-y-6">
                {reviewsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                  </div>
                ) : (
                  <>
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        <ShoppingBag className="h-4 w-4 text-blue-500" />
                        {lbl('Avaliações como Vendedor', 'Reviews as Seller', 'Reseñas como Vendedor')}
                        <span className="text-xs text-gray-400">({sellerReviews.length})</span>
                      </h4>
                      {sellerReviews.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                          {lbl('Nenhuma avaliação ainda', 'No reviews yet', 'Sin reseñas aún')}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {sellerReviews.map((r: any) => (
                            <div key={r.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-200 dark:border-gray-600">
                              <div className="flex items-start justify-between mb-1">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {r.profiles?.full_name || 'Anonymous'}
                                </span>
                                <div className="flex items-center">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'}`} />
                                  ))}
                                </div>
                              </div>
                              <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                              {r.comment && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5">{r.comment}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        <User className="h-4 w-4 text-green-500" />
                        {lbl('Avaliações como Cliente', 'Reviews as Customer', 'Reseñas como Cliente')}
                        <span className="text-xs text-gray-400">({customerReviews.length})</span>
                      </h4>
                      {customerReviews.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                          {lbl('Nenhuma avaliação ainda', 'No reviews yet', 'Sin reseñas aún')}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {customerReviews.map((r: any) => (
                            <div key={r.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-200 dark:border-gray-600">
                              <div className="flex items-start justify-between mb-1">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {r.profiles?.full_name || 'Anonymous'}
                                </span>
                                <div className="flex items-center">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'}`} />
                                  ))}
                                </div>
                              </div>
                              <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                              {r.comment && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5">{r.comment}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {isSelf && (
        <PasswordChangeModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
        />
      )}

      {/* Seller Request Form */}
      {isSelf && showSellerRequestForm && (
        <SellerRequestForm
          onClose={() => setShowSellerRequestForm(false)}
          onSuccess={() => {
            setShowSellerRequestForm(false);
            setHasRequestedSeller(true);
          }}
        />
      )}

      {/* Chat Modal (public view) */}
      {chatOpen && profile && !isSelf && (
        <ChatModal
          otherUserId={profile.id}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
