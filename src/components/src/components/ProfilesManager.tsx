import React, { useState, useEffect } from 'react';
import { X, Plus, Edit, Trash2, User, AlertTriangle, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { supabase, AccountProfile, Client, StreamingAccount } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface ProfilesManagerProps {
  account: StreamingAccount;
  onClose: () => void;
}

interface ProfileFormData {
  client_id: string;
  profile_name: string;
  assigned_date: string;
  price_paid: number;
  status: 'active' | 'inactive';
  expiry_date: string;
}

export function ProfilesManager({ account, onClose }: ProfilesManagerProps) {
  const { t } = useLanguage();
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<AccountProfile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AccountProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>({
    client_id: '',
    profile_name: '',
    assigned_date: new Date().toISOString().split('T')[0],
    price_paid: 0,
    status: 'active',
    expiry_date: ''
  });

  useEffect(() => {
    loadData();
  }, [account.id]);

  useEffect(() => {
    if (editingProfile) {
      setFormData({
        client_id: editingProfile.client_id || '',
        profile_name: editingProfile.profile_name,
        assigned_date: editingProfile.assigned_date,
        price_paid: editingProfile.price_paid,
        status: editingProfile.status,
        expiry_date: editingProfile.expiry_date || ''
      });
    } else {
      setFormData({
        client_id: '',
        profile_name: '',
        assigned_date: new Date().toISOString().split('T')[0],
        price_paid: 0,
        status: 'active',
        expiry_date: ''
      });
    }
  }, [editingProfile]);

  async function loadData() {
    setLoading(true);
    try {
      // Carregar perfis da conta
      const { data: profilesData } = await supabase
        .from('account_profiles')
        .select(`
          *,
          clients (id, name, email)
        `)
        .eq('account_id', account.id)
        .order('created_at', { ascending: false });

      // Carregar apenas clientes do usuário atual
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', account.user_id || '')
        .order('name');

      if (profilesData) setProfiles(profilesData);
      if (clientsData) setClients(clientsData);
    } catch (error) {
      console.error('Erro ao carregar dados dos perfis:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const dataToSave = {
        ...formData,
        account_id: account.id,
        client_id: formData.client_id || null,
        expiry_date: formData.expiry_date || null,
        updated_at: new Date().toISOString()
      };

      if (editingProfile) {
        // Atualizar perfil existente
        const { error } = await supabase
          .from('account_profiles')
          .update(dataToSave)
          .eq('id', editingProfile.id);

        if (error) throw error;
      } else {
        // Criar novo perfil
        const { error } = await supabase
          .from('account_profiles')
          .insert([dataToSave]);

        if (error) throw error;

        // Atualizar contador de perfis usados na conta
        const { error: updateError } = await supabase
          .from('streaming_accounts')
          .update({ 
            used_profiles: account.used_profiles + 1,
            updated_at: new Date().toISOString(),
            user_id: account.user_id // Preserve user_id
          })
          .eq('id', account.id);

        if (updateError) throw updateError;
      }

      await loadData();
      setShowForm(false);
      setEditingProfile(null);
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      alert(t.language === 'pt' ? 'Erro ao salvar perfil' :
           t.language === 'en' ? 'Error saving profile' :
           'Error al guardar perfil');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProfile(profile: AccountProfile) {
    if (!confirm(t.language === 'pt' ? 'Tem certeza que deseja excluir este perfil?' :
                t.language === 'en' ? 'Are you sure you want to delete this profile?' :
                '¿Estás seguro de que quieres eliminar este perfil?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('account_profiles')
        .delete()
        .eq('id', profile.id);

      if (error) throw error;

      // Atualizar contador de perfis usados na conta
      const { error: updateError } = await supabase
        .from('streaming_accounts')
        .update({ 
          used_profiles: Math.max(0, account.used_profiles - 1),
          updated_at: new Date().toISOString(),
          user_id: account.user_id // Preserve user_id
        })
        .eq('id', account.id);

      if (updateError) throw updateError;

      setProfiles(profiles.filter(p => p.id !== profile.id));
    } catch (error) {
      console.error('Erro ao excluir perfil:', error);
      alert(t.language === 'pt' ? 'Erro ao excluir perfil' :
           t.language === 'en' ? 'Error deleting profile' :
           'Error al eliminar perfil');
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (error) {
      console.error('Error copying text:', error);
    }
  }

  const canAddProfile = profiles.length < account.total_profiles;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 sm:top-10 mx-auto p-4 sm:p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
              {t.accountProfiles}
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
              {account.streaming_services?.name} - {account.email}
            </p>
            
            {/* Account Credentials Section */}
            <div className="mt-3 sm:mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
              <h4 className="text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-300 mb-2 sm:mb-3 flex items-center">
                <User className="h-4 w-4 mr-2" />
                Credenciais da Conta Principal
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                    Email:
                  </label>
                  <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-md p-2">
                    <span className="font-mono text-xs sm:text-sm text-gray-900 dark:text-white break-all flex-1 mr-2">
                      {account.email}
                    </span>
                    <button
                      onClick={() => copyToClipboard(account.email)}
                      className="p-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 transition-colors touch-manipulation flex-shrink-0"
                      title="Copiar email"
                    >
                      {copiedText === account.email ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                    Senha:
                  </label>
                  <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-md p-2">
                    <span className="font-mono text-xs sm:text-sm text-gray-900 dark:text-white break-all flex-1 mr-2">
                      {showAccountPassword ? account.password : '••••••••'}
                    </span>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <button
                        onClick={() => setShowAccountPassword(!showAccountPassword)}
                        className="p-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 transition-colors touch-manipulation"
                        title={showAccountPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showAccountPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      {showAccountPassword && (
                        <button
                          onClick={() => copyToClipboard(account.password)}
                          className="p-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 transition-colors touch-manipulation"
                          title="Copiar senha"
                        >
                          {copiedText === account.password ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-2 sm:mt-3 text-xs text-blue-600 dark:text-blue-400">
                💡 Use estas credenciais para acessar a conta principal do serviço
              </div>
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {profiles.length} {t.of} {account.total_profiles} {t.profilesUsed}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 touch-manipulation"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {canAddProfile && (
          <div className="mb-4 sm:mb-6">
            <button
              onClick={() => setShowForm(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 sm:py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors touch-manipulation"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t.newProfile}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-24 sm:h-32">
            <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            {profiles.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <User className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white px-4">{t.noDataFound}</h3>
                <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400 px-4">
                  {t.accountProfiles}
                </p>
                {canAddProfile && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors touch-manipulation"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t.language === 'pt' ? 'Adicionar Primeiro Perfil' :
                     t.language === 'en' ? 'Add First Profile' :
                     'Agregar Primer Perfil'}
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t.profileName}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t.client}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t.assignedDate}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t.expiryDate}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t.pricePaid}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t.status}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {t.actions}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {profiles.map((profile) => (
                      <tr key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {profile.profile_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {profile.clients?.name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {new Date(profile.assigned_date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {profile.expiry_date ? (
                            <div className="flex items-center">
                              {(() => {
                                const expiry = new Date(profile.expiry_date);
                                const today = new Date();
                                const diffTime = expiry.getTime() - today.getTime();
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                const isExpiringSoon = diffDays <= 7 && diffDays >= 0;
                                const isExpired = diffDays < 0;
                                
                                return (
                                  <>
                                    {(isExpiringSoon || isExpired) && (
                                      <AlertTriangle className={`h-4 w-4 mr-1 ${isExpired ? 'text-red-500' : 'text-yellow-500'}`} />
                                    )}
                                    <span className={
                                      isExpired ? 'text-red-600 font-medium' :
                                      isExpiringSoon ? 'text-yellow-600 font-medium' : ''
                                    }>
                                      {expiry.toLocaleDateString('pt-BR')}
                                    </span>
                                  </>
                                );
                              })()}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          ${profile.price_paid.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            profile.status === 'active' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {profile.status === 'active' ? t.active : t.inactive}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                setEditingProfile(profile);
                                setShowForm(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors touch-manipulation"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProfile(profile)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors touch-manipulation"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-3">
                {profiles.map((profile) => (
                  <div key={profile.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {profile.profile_name}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {profile.clients?.name || 'Sem cliente atribuído'}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        profile.status === 'active' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' 
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {profile.status === 'active' ? t.active : t.inactive}
                      </span>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Data de Atribuição</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(profile.assigned_date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Valor Pago</p>
                        <p className="text-sm font-bold text-green-600 dark:text-green-400">
                          ${profile.price_paid.toFixed(2)}
                        </p>
                      </div>
                      {profile.expiry_date && (
                        <div className="col-span-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Data de Expiração</p>
                          <div className="flex items-center">
                            {(() => {
                              const expiry = new Date(profile.expiry_date);
                              const today = new Date();
                              const diffTime = expiry.getTime() - today.getTime();
                              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                              const isExpiringSoon = diffDays <= 7 && diffDays >= 0;
                              const isExpired = diffDays < 0;
                              
                              return (
                                <>
                                  {(isExpiringSoon || isExpired) && (
                                    <AlertTriangle className={`h-4 w-4 mr-1 ${isExpired ? 'text-red-500' : 'text-yellow-500'}`} />
                                  )}
                                  <span className={`text-sm font-medium ${
                                    isExpired ? 'text-red-600 dark:text-red-400' :
                                    isExpiringSoon ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'
                                  }`}>
                                    {expiry.toLocaleDateString('pt-BR')}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-600">
                      <button
                        onClick={() => {
                          setEditingProfile(profile);
                          setShowForm(true);
                        }}
                        className="inline-flex items-center px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm touch-manipulation"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        <span>Editar</span>
                      </button>
                      
                      <button
                        onClick={() => handleDeleteProfile(profile)}
                        className="inline-flex items-center px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm touch-manipulation"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
            )}
          </>
        )}

        {/* Formulário de perfil */}
        {showForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-60 p-4">
            <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
                  {editingProfile ? t.editProfile : t.newProfile}
                </h4>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingProfile(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 touch-manipulation"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t.profileName} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.profile_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, profile_name: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm sm:text-base touch-manipulation"
                    placeholder="Ex: Perfil 1, João, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Data de Expiração
                </label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base touch-manipulation"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Deixe em branco se o perfil não tem data de expiração específica
                </p>
              </div>

                    {t.client}
                  </label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base touch-manipulation"
                  >
                    <option value="">{t.client}</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t.assignedDate} *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.assigned_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, assigned_date: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base touch-manipulation"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t.pricePaid} (USD) *
                    </label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={formData.price_paid}
                      onChange={(e) => setFormData(prev => ({ ...prev, price_paid: parseFloat(e.target.value) }))}
                      className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base touch-manipulation"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t.status} *
                  </label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base touch-manipulation"
                  >
                    <option value="active">{t.active}</option>
                    <option value="inactive">{t.inactive}</option>
                  </select>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingProfile(null);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors touch-manipulation"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors touch-manipulation"
                  >
                    {saving ? `${t.save}...` : (editingProfile ? t.edit : t.add)}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}