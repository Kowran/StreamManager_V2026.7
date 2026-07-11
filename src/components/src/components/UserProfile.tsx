import React, { useState, useEffect } from 'react';
import { User, Edit, Save, X, Mail, Calendar, Globe, Shield, Eye, EyeOff, Check, AlertCircle, Camera, Upload, Store } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { useNotificationContext } from './NotificationProvider';
import { PasswordChangeModal } from './PasswordChangeModal';
import { SellerRequestForm } from './SellerRequestForm';

interface UserProfileData {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  language: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  login_count: number;
}

interface UserCredits {
  // Credits system removed
}

export function UserProfile() {
  const { user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { addNotification } = useNotificationContext();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [userCredits, setUserCredits] = useState<UserCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSellerRequestForm, setShowSellerRequestForm] = useState(false);
  const [hasRequestedSeller, setHasRequestedSeller] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    language: 'pt',
    avatar_url: ''
  });

  useEffect(() => {
    if (user) {
      loadUserProfile();
      checkSellerRequest();
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        language: profile.language || 'pt',
        avatar_url: profile.avatar_url || ''
      });
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
    } catch (error) {
      console.error('Error loading profile:', error);
      setError('Erro ao carregar perfil do usuário');
    } finally {
      setLoading(false);
    }
  }

  async function loadUserCredits() {
    // Credits system removed
    return;
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
    } catch (error) {
      console.error('Error checking seller request:', error);
    }
  }

  async function handleSave() {
    if (!user || !profile) return;

    setSaving(true);
    setError('');

    try {
      // Validate form data
      if (!formData.full_name.trim()) {
        throw new Error('Nome completo é obrigatório');
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim(),
          language: formData.language,
          avatar_url: formData.avatar_url || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update language in context if changed
      if (formData.language !== language) {
        setLanguage(formData.language as any);
      }

      // Reload profile data
      await loadUserProfile();
      
      setSuccess(true);
      setEditing(false);
      
      // Show success notification
      await addNotification({
        type: 'system',
        title: '✅ Perfil Atualizado',
        message: 'Suas informações pessoais foram atualizadas com sucesso!',
        data: { action: 'profile_updated' },
        priority: 'medium'
      });

      setTimeout(() => setSuccess(false), 3000);

    } catch (error) {
      console.error('Error saving profile:', error);
      setError(error instanceof Error ? error.message : 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditing(false);
    setError('');
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        language: profile.language || 'pt',
        avatar_url: profile.avatar_url || ''
      });
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return t.language === 'pt' ? 'Nunca' : t.language === 'en' ? 'Never' : 'Nunca';
    return new Date(dateString).toLocaleDateString(
      t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getRoleLabel(role: string) {
    switch (role) {
      case 'admin': return t.language === 'pt' ? 'Administrador' : t.language === 'en' ? 'Administrator' : 'Administrador';
      case 'customer': return t.language === 'pt' ? 'Cliente' : t.language === 'en' ? 'Customer' : 'Cliente';
      default: return role;
    }
  }

  function getLanguageLabel(lang: string) {
    switch (lang) {
      case 'pt': return 'Português (Brasil)';
      case 'en': return 'English';
      case 'es': return 'Español';
      default: return lang;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <User className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          {t.profileNotFound}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t.couldNotLoadProfile}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t.myProfile}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t.profileDescription}
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            <Edit className="h-4 w-4 mr-2" />
            {t.editProfile}
          </button>
        )}
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center">
            <Check className="h-5 w-5 text-green-500 mr-2" />
            <span className="text-sm text-green-700 dark:text-green-400">
              {t.profileUpdated}
            </span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t.basicInformation}
              </h3>
              {editing && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="h-4 w-4 mr-1 inline" />
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm disabled:opacity-50 transition-colors"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1 inline-block"></div>
                        {t.saving}...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-1 inline" />
                        {t.save}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center space-x-6">
                <div className="relative">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="w-20 h-20 rounded-full object-cover border-4 border-gray-200 dark:border-gray-600"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center border-4 border-gray-200 dark:border-gray-600 ${profile.avatar_url ? 'hidden' : ''}`}>
                    <User className="h-8 w-8 text-white" />
                  </div>
                  {editing && (
                    <button
                      onClick={() => {
                        const url = prompt('Digite a URL da sua foto de perfil:');
                        if (url) {
                          setFormData(prev => ({ ...prev, avatar_url: url }));
                        }
                      }}
                      className="absolute -bottom-1 -right-1 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition-colors"
                      title={t.changePhoto}
                    >
                      <Camera className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {profile.full_name || (t.language === 'pt' ? 'Usuário' : t.language === 'en' ? 'User' : 'Usuario')}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{profile.email}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      profile.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400' 
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                    }`}>
                      {profile.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                      {getRoleLabel(profile.role)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t.fullName} *
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                      className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder={
                        t.language === 'pt' ? 'Digite seu nome completo' :
                        t.language === 'en' ? 'Enter your full name' :
                        'Ingresa tu nombre completo'
                      }
                    />
                  ) : (
                    <div className="flex items-center space-x-2 py-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900 dark:text-white">
                        {profile.full_name || (t.language === 'pt' ? 'Não informado' : t.language === 'en' ? 'Not provided' : 'No informado')}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <div className="flex items-center space-x-2 py-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900 dark:text-white">{profile.email}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">({t.notEditable})</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t.preferredLanguage}
                  </label>
                  {editing ? (
                    <select
                      value={formData.language}
                      onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                      className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="pt">Português (Brasil)</option>
                      <option value="en">English</option>
                      <option value="es">Español</option>
                    </select>
                  ) : (
                    <div className="flex items-center space-x-2 py-2">
                      <Globe className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900 dark:text-white">
                        {getLanguageLabel(profile.language)}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t.accountType}
                  </label>
                  <div className="flex items-center space-x-2 py-2">
                    <Shield className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900 dark:text-white">
                      {getRoleLabel(profile.role)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">({t.notEditable})</span>
                  </div>
                </div>
              </div>

              {/* Avatar URL (only when editing) */}
              {editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t.profilePhotoUrl}
                  </label>
                  <input
                    type="url"
                    value={formData.avatar_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, avatar_url: e.target.value }))}
                    className="block w-full rounded-lg border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="https://exemplo.com/sua-foto.jpg"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t.pasteImageUrl}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Account Security */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              {t.accountSecurity}
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                      {t.changePassword}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {t.keepAccountSecure}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {t.changePassword}
                </button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                  🔒 {t.securityTips}
                </h4>
                <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                  <li>• {t.useUniquePassword}</li>
                  <li>• {t.dontShareCredentials}</li>
                  <li>• {t.logoutSharedDevices}</li>
                  <li>• {t.keepInfoUpdated}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Account Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t.accountStats}
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{t.memberSince}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date(profile.created_at).toLocaleDateString(
                    t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
                  )}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{t.lastLogin}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {profile.last_login_at 
                    ? new Date(profile.last_login_at).toLocaleDateString(
                        t.language === 'pt' ? 'pt-BR' : t.language === 'en' ? 'en-US' : 'es-ES'
                      )
                    : (t.language === 'pt' ? 'Nunca' : t.language === 'en' ? 'Never' : 'Nunca')
                  }
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">{t.totalLogins}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {profile.login_count || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Credits Summary */}

          {/* Account Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t.accountDetails}
            </h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t.userId}</span>
                <span className="font-mono text-xs text-gray-900 dark:text-white break-all">
                  {profile.id}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t.accountCreated}</span>
                <span className="text-gray-900 dark:text-white">
                  {formatDate(profile.created_at)}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">{t.lastUpdate}</span>
                <span className="text-gray-900 dark:text-white">
                  {formatDate(profile.updated_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t.quickActions}
            </h3>
            
            <div className="space-y-3">
              <button
                onClick={() => setShowPasswordModal(true)}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                <Shield className="h-4 w-4" />
                <span>{t.changePassword}</span>
              </button>
              
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  <span>{t.editProfile}</span>
                </button>
              )}

              {profile.role !== 'seller' && profile.role !== 'admin' && !hasRequestedSeller && (
                <button
                  onClick={() => setShowSellerRequestForm(true)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                >
                  <Store className="h-4 w-4" />
                  <span>{language === 'pt' ? 'Solicitar Permissão para Vender' : language === 'en' ? 'Request Seller Permission' : 'Solicitar Permiso de Vendedor'}</span>
                </button>
              )}

              {hasRequestedSeller && profile.role !== 'seller' && profile.role !== 'admin' && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400 text-center">
                    {language === 'pt' ? 'Solicitação pendente de aprovação' : language === 'en' ? 'Request pending approval' : 'Solicitud pendiente de aprobación'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
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
            addNotification({
              type: 'success',
              message: language === 'pt' ? 'Solicitação enviada com sucesso!' : language === 'en' ? 'Request submitted successfully!' : 'Solicitud enviada con éxito!'
            });
          }}
        />
      )}
    </div>
  );
}