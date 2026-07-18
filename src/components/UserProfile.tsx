import React, { useState, useEffect, useRef } from 'react';
import { User, Save, X, Mail, Globe, Shield, Check, AlertCircle, Camera, Store, Bell, BellOff, CreditCard as Edit3, Palette, Sparkles, ImagePlus, Trash2, Star, ShoppingBag, ZoomIn, ZoomOut, Move, RotateCcw } from 'lucide-react';
import { supabase, hasAccountsAccess } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useNotificationContext } from './NotificationProvider';
import { SellerRequestForm } from './SellerRequestForm';
import { OnlineBadge } from './OnlineBadge';
import { PasswordChangeModal } from './PasswordChangeModal';
import { LevelBadge, LevelProgressBar } from './LevelBadge';

interface UserProfileData {
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
}

interface UserProfileProps {
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

export function UserProfile({ onNavigate }: UserProfileProps = {}) {
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { addNotification } = useNotificationContext();

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSellerRequestForm, setShowSellerRequestForm] = useState(false);
  const [hasRequestedSeller, setHasRequestedSeller] = useState(false);
  const [hasStreamingAccess, setHasStreamingAccess] = useState(false);
  const [hideExpiringBalloon, setHideExpiringBalloon] = useState(false);
  const [savingBalloonPref, setSavingBalloonPref] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverZoom, setCoverZoom] = useState(1.0);
  const [coverPosX, setCoverPosX] = useState(50.0);
  const [coverPosY, setCoverPosY] = useState(50.0);
  const [adjustingCover, setAdjustingCover] = useState(false);
  const [draggingCover, setDraggingCover] = useState(false);
  const coverDragStart = useRef({ x: 0, y: 0, posX: 50, posY: 50 });
  const [activeTab, setActiveTab] = useState<'info' | 'appearance' | 'security' | 'reviews'>('info');
  const [sellerReviews, setSellerReviews] = useState<any[]>([]);
  const [customerReviews, setCustomerReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    language: 'pt',
    bio: '',
    theme_color: '#3b82f6',
    profile_badge: '',
  });

  useEffect(() => {
    if (user) {
      loadUserProfile();
      checkSellerRequest();
      checkStreamingAccess();
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab === 'reviews') {
      loadUserRatings();
    }
  }, [user, activeTab]);

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
      setCoverZoom(profile.cover_zoom ? Number(profile.cover_zoom) : 1.0);
      setCoverPosX(profile.cover_position_x ? Number(profile.cover_position_x) : 50.0);
      setCoverPosY(profile.cover_position_y ? Number(profile.cover_position_y) : 50.0);
    }
  }, [profile]);

  async function loadUserProfile() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Erro ao carregar perfil');
    } finally {
      setLoading(false);
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

  async function loadUserRatings() {
    if (!user) return;
    setReviewsLoading(true);
    try {
      const { data: asSeller } = await supabase
        .from('user_ratings')
        .select('id, rating, comment, created_at, rater_role, rater_id')
        .eq('rated_user_id', user.id)
        .eq('rater_role', 'customer')
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: asCustomer } = await supabase
        .from('user_ratings')
        .select('id, rating, comment, created_at, rater_role, rater_id')
        .eq('rated_user_id', user.id)
        .eq('rater_role', 'seller')
        .order('created_at', { ascending: false })
        .limit(20);

      const allRaterIds = [...(asSeller || []), ...(asCustomer || [])].map(r => r.rater_id).filter(Boolean);
      const uniqueIds = [...new Set(allRaterIds)] as string[];

      let profileMap: Record<string, string> = {};
      if (uniqueIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', uniqueIds);
        if (profiles) {
          profileMap = profiles.reduce((acc, p) => {
            acc[p.id] = p.full_name || 'Anonymous';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const enrich = (ratings: any[]) => (ratings || []).map(r => ({
        ...r,
        profiles: { full_name: profileMap[r.rater_id] || 'Anonymous' }
      }));

      setSellerReviews(enrich(asSeller));
      setCustomerReviews(enrich(asCustomer));
    } catch (err) {
      console.error('Error loading user ratings:', err);
    } finally {
      setReviewsLoading(false);
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
    if (!file || !user) return;
    const url = await uploadImage(file, 'avatars', setUploadingAvatar);
    if (url) {
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
      await loadUserProfile();
    }
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const url = await uploadImage(file, 'covers', setUploadingCover);
    if (url) {
      await supabase.from('profiles').update({ cover_url: url, cover_zoom: 1.0, cover_position_x: 50.0, cover_position_y: 50.0 }).eq('id', user.id);
      setCoverZoom(1.0); setCoverPosX(50.0); setCoverPosY(50.0);
      await loadUserProfile();
    }
  }

  async function saveCoverPosition() {
    if (!user) return;
    await supabase.from('profiles').update({ cover_zoom: coverZoom, cover_position_x: coverPosX, cover_position_y: coverPosY }).eq('id', user.id);
    setAdjustingCover(false);
    await loadUserProfile();
  }

  function handleCoverMouseDown(e: React.MouseEvent) {
    if (!adjustingCover) return;
    setDraggingCover(true);
    coverDragStart.current = { x: e.clientX, y: e.clientY, posX: coverPosX, posY: coverPosY };
  }

  function handleCoverMouseMove(e: React.MouseEvent) {
    if (!draggingCover) return;
    const dx = e.clientX - coverDragStart.current.x;
    const dy = e.clientY - coverDragStart.current.y;
    setCoverPosX(Math.max(0, Math.min(100, coverDragStart.current.posX + (dx / 3))));
    setCoverPosY(Math.max(0, Math.min(100, coverDragStart.current.posY + (dy / 3))));
  }

  function handleCoverMouseUp() {
    setDraggingCover(false);
  }

  async function removeCover() {
    if (!user) return;
    await supabase.from('profiles').update({ cover_url: null, cover_zoom: 1.0, cover_position_x: 50.0, cover_position_y: 50.0 }).eq('id', user.id);
    setCoverZoom(1.0); setCoverPosX(50.0); setCoverPosY(50.0);
    await loadUserProfile();
  }

  async function removeAvatar() {
    if (!user) return;
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
    await loadUserProfile();
  }

  async function handleSave() {
    if (!user || !profile) return;
    setSaving(true);
    setError('');
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

      await loadUserProfile();
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

  function cancelEdit() {
    setEditing(false);
    setError('');
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
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  function getRoleLabel(role: string) {
    const labels: Record<string, string> = {
      admin: language === 'pt' ? 'Administrador' : language === 'en' ? 'Administrator' : 'Administrador',
      customer: language === 'pt' ? 'Cliente' : language === 'en' ? 'Customer' : 'Cliente',
      seller: language === 'pt' ? 'Vendedor' : language === 'en' ? 'Seller' : 'Vendedor',
    };
    return labels[role] || role;
  }

  const themeColor = profile?.theme_color || '#3b82f6';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-16">
        <User className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
        <p className="mt-3 text-gray-500 dark:text-gray-400">Perfil não encontrado</p>
      </div>
    );
  }

  const tabs = [
    { id: 'info' as const, label: language === 'pt' ? 'Informações' : 'Information', icon: User },
    { id: 'appearance' as const, label: language === 'pt' ? 'Aparência' : 'Appearance', icon: Palette },
    { id: 'security' as const, label: language === 'pt' ? 'Segurança' : 'Security', icon: Shield },
    { id: 'reviews' as const, label: language === 'pt' ? 'Avaliações' : 'Reviews', icon: Star },
  ];

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-0">
      {/* Hidden file inputs */}
      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
      <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverUpload} />

      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">

        {/* Cover image area */}
        <div
          className="relative h-36 sm:h-48 group overflow-hidden"
          onMouseMove={handleCoverMouseMove}
          onMouseUp={handleCoverMouseUp}
          onMouseLeave={handleCoverMouseUp}
        >
          {profile.cover_url ? (
            <div
              className="w-full h-full overflow-hidden"
              style={{ cursor: adjustingCover ? (draggingCover ? 'grabbing' : 'grab') : 'default' }}
              onMouseDown={handleCoverMouseDown}
            >
              <img
                src={profile.cover_url}
                alt="Capa"
                className="w-full h-full object-cover transition-transform duration-150"
                style={{
                  transform: `scale(${coverZoom})`,
                  transformOrigin: `${coverPosX}% ${coverPosY}%`,
                }}
                draggable={false}
              />
            </div>
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(135deg, ${themeColor}33 0%, ${themeColor}88 50%, ${themeColor}55 100%)`,
              }}
            />
          )}
          {/* Cover overlay pattern */}
          {!profile.cover_url && (
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)`,
                backgroundSize: '40px 40px',
              }}
            />
          )}
          {/* Adjust cover toolbar */}
          {adjustingCover && profile.cover_url && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/70 backdrop-blur-md rounded-xl px-2 py-1.5 z-10">
              <button onClick={() => setCoverZoom(z => Math.max(1.0, +(z - 0.1).toFixed(1)))} className="p-1.5 text-white hover:bg-white/20 rounded-lg transition-colors">
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-white text-xs font-medium w-10 text-center">{coverZoom.toFixed(1)}x</span>
              <button onClick={() => setCoverZoom(z => Math.min(3.0, +(z + 0.1).toFixed(1)))} className="p-1.5 text-white hover:bg-white/20 rounded-lg transition-colors">
                <ZoomIn className="h-4 w-4" />
              </button>
              <div className="w-px h-5 bg-white/20" />
              <button onClick={() => { setCoverZoom(1.0); setCoverPosX(50.0); setCoverPosY(50.0); }} className="p-1.5 text-white hover:bg-white/20 rounded-lg transition-colors">
                <RotateCcw className="h-4 w-4" />
              </button>
              <div className="w-px h-5 bg-white/20" />
              <button onClick={saveCoverPosition} className="px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors">
                {language === 'pt' ? 'Salvar' : 'Save'}
              </button>
            </div>
          )}
          {/* Cover actions */}
          {!adjustingCover && (
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
                {language === 'pt' ? 'Trocar capa' : 'Change cover'}
              </button>
              {profile.cover_url && (
                <>
                  <button
                    onClick={() => setAdjustingCover(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-xs font-medium rounded-lg transition-colors backdrop-blur-sm"
                  >
                    <Move className="h-3.5 w-3.5" />
                    {language === 'pt' ? 'Ajustar' : 'Adjust'}
                  </button>
                  <button
                    onClick={removeCover}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/80 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors backdrop-blur-sm"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {language === 'pt' ? 'Remover' : 'Remove'}
                  </button>
                </>
              )}
            </div>
          )}
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
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-8 w-8 text-white" />
                  </div>
                )}
              </div>
              {/* Avatar overlay */}
              <div className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 cursor-pointer"
                onClick={() => avatarInputRef.current?.click()}
              >
                {uploadingAvatar ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </div>
              {/* Remove avatar button */}
              {profile.avatar_url && (
                <button
                  onClick={removeAvatar}
                  className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Edit button */}
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Edit3 className="h-4 w-4" />
                {language === 'pt' ? 'Editar' : 'Edit'}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                  {language === 'pt' ? 'Cancelar' : 'Cancel'}
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
                  {saving ? (language === 'pt' ? 'Salvando...' : 'Saving...') : (language === 'pt' ? 'Salvar' : 'Save')}
                </button>
              </div>
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
                  {profile.full_name || 'Usuário'}
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
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" />
              {profile.email}
            </p>

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
                  placeholder={language === 'pt' ? 'Escreva algo sobre você...' : 'Write something about yourself...'}
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
            <div className="text-xs text-gray-500 dark:text-gray-400">{language === 'pt' ? 'Logins' : 'Logins'}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
            <div className="text-xs font-semibold text-gray-900 dark:text-white">
              {formatDate(profile.created_at)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{language === 'pt' ? 'Membro desde' : 'Member since'}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center">
            <div className="text-xs font-semibold text-gray-900 dark:text-white">
              {profile.last_login_at ? formatDate(profile.last_login_at) : '-'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{language === 'pt' ? 'Último acesso' : 'Last login'}</div>
          </div>
        </div>
        {/* Level Progress */}
        <div className="px-6 pb-5 space-y-3">
          {profile.user_level != null && (
            <LevelProgressBar level={profile.user_level} xp={profile.user_xp || 0} type="user" language={language} />
          )}
          {(profile.role === 'seller' || profile.role === 'admin') && profile.seller_level != null && (
            <LevelProgressBar level={profile.seller_level} xp={profile.seller_xp || 0} type="seller" language={language} />
          )}
        </div>

        {/* Online status strip */}
        <div className="px-6 pb-5">
          <div className="flex items-center justify-center gap-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl py-2.5">
            <OnlineBadge lastSeenAt={profile.last_seen_at} language={language} showLabel size="md" />
          </div>
        </div>
      </div>

      {/* Feedback messages */}
      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-center gap-2 mt-3">
          <Check className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="text-sm text-emerald-700 dark:text-emerald-400">
            {language === 'pt' ? 'Perfil atualizado com sucesso!' : 'Profile updated successfully!'}
          </span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-2 mt-3">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Tabs */}
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
                    {language === 'pt' ? 'Nome completo' : 'Full name'}
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
                    {language === 'pt' ? 'Idioma' : 'Language'}
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
                    <span className="text-xs text-gray-400">(não editável)</span>
                  </p>
                </div>
              </div>

              {/* Account details */}
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  {language === 'pt' ? 'Detalhes da conta' : 'Account details'}
                </h4>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">ID</span>
                  <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate max-w-[180px]">{profile.id}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">{language === 'pt' ? 'Última atualização' : 'Last update'}</span>
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
                    {language === 'pt' ? 'Solicitar permissão para vender' : 'Request seller permission'}
                  </button>
                )}
                {profile.role === 'seller' && onNavigate && (
                  <button
                    onClick={() => onNavigate('seller-store')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white font-medium rounded-xl transition-colors text-sm"
                    style={{ backgroundColor: themeColor }}
                  >
                    <Store className="h-4 w-4" />
                    {language === 'pt' ? 'Minha Loja' : 'My Store'}
                  </button>
                )}
                {hasRequestedSeller && profile.role !== 'seller' && profile.role !== 'admin' && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-center">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      {language === 'pt' ? 'Solicitação pendente de aprovação' : 'Request pending approval'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* APPEARANCE TAB */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Theme color */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  {language === 'pt' ? 'Cor do tema' : 'Theme color'}
                  <span className="ml-2 text-xs normal-case font-normal text-gray-400">
                    {language === 'pt' ? '(visível para todos)' : '(visible to everyone)'}
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
                  {/* Custom color picker */}
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
                {/* Live preview */}
                <div className="mt-3 flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: formData.theme_color }}>
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="h-2 w-24 rounded-full" style={{ backgroundColor: formData.theme_color }} />
                    <div className="h-1.5 w-16 rounded-full mt-1.5" style={{ backgroundColor: `${formData.theme_color}66` }} />
                  </div>
                  <span className="text-xs text-gray-400 ml-auto">{language === 'pt' ? 'Pré-visualização' : 'Preview'}</span>
                </div>
              </div>

              {/* Badge */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  {language === 'pt' ? 'Badge do perfil' : 'Profile badge'}
                  <span className="ml-2 text-xs normal-case font-normal text-gray-400">
                    {language === 'pt' ? '(visível para todos)' : '(visible to everyone)'}
                  </span>
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
                      {badge.label || (language === 'pt' ? 'Nenhum' : 'None')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cover image management */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  {language === 'pt' ? 'Imagem de capa' : 'Cover image'}
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
                    {language === 'pt' ? 'Fazer upload' : 'Upload'}
                  </button>
                  {profile.cover_url && (
                    <button
                      onClick={removeCover}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      {language === 'pt' ? 'Remover capa' : 'Remove cover'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {language === 'pt' ? 'JPG, PNG ou WebP. Máximo 5MB.' : 'JPG, PNG, or WebP. Max 5MB.'}
                </p>
              </div>

              {/* Apply button */}
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
                {saving
                  ? (language === 'pt' ? 'Salvando...' : 'Saving...')
                  : (language === 'pt' ? 'Aplicar aparência' : 'Apply appearance')}
              </button>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              {/* Change password */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <Shield className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {language === 'pt' ? 'Alterar senha' : 'Change password'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {language === 'pt' ? 'Mantenha sua conta segura' : 'Keep your account secure'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="px-3 py-1.5 text-sm font-medium text-white rounded-xl transition-colors"
                  style={{ backgroundColor: themeColor }}
                >
                  {language === 'pt' ? 'Alterar' : 'Change'}
                </button>
              </div>

              {/* Expiring balloon toggle */}
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
                        {language === 'pt' ? 'Balão de contas vencidas' : 'Expiring accounts balloon'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {language === 'pt' ? 'Notificação flutuante' : 'Floating notification'}
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

              {/* Security tips */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide mb-2">
                  {language === 'pt' ? 'Dicas de segurança' : 'Security tips'}
                </h4>
                <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1.5">
                  <li className="flex items-start gap-1.5">
                    <Check className="h-3 w-3 mt-0.5 shrink-0" />
                    {language === 'pt' ? 'Use uma senha única e forte' : 'Use a unique, strong password'}
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="h-3 w-3 mt-0.5 shrink-0" />
                    {language === 'pt' ? 'Não compartilhe suas credenciais' : "Don't share your credentials"}
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="h-3 w-3 mt-0.5 shrink-0" />
                    {language === 'pt' ? 'Saia em dispositivos compartilhados' : 'Log out on shared devices'}
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
                  {/* Reviews as Seller */}
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      <ShoppingBag className="h-4 w-4 text-blue-500" />
                      {language === 'pt' ? 'Avaliações como Vendedor' : 'Reviews as Seller'}
                      <span className="text-xs text-gray-400">({sellerReviews.length})</span>
                    </h4>
                    {sellerReviews.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                        {language === 'pt' ? 'Nenhuma avaliação ainda' : 'No reviews yet'}
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

                  {/* Reviews as Customer */}
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      <User className="h-4 w-4 text-green-500" />
                      {language === 'pt' ? 'Avaliações como Cliente' : 'Reviews as Customer'}
                      <span className="text-xs text-gray-400">({customerReviews.length})</span>
                    </h4>
                    {customerReviews.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
                        {language === 'pt' ? 'Nenhuma avaliação ainda' : 'No reviews yet'}
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
      <PasswordChangeModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />

      {/* Seller Request Form */}
      {showSellerRequestForm && (
        <SellerRequestForm
          onClose={() => setShowSellerRequestForm(false)}
          onSuccess={() => {
            setShowSellerRequestForm(false);
            setHasRequestedSeller(true);
          }}
        />
      )}
    </div>
  );
}
