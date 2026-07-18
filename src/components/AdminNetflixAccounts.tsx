import React, { useEffect, useState } from 'react';
import { Mail, Plus, Trash2, CreditCard as Edit2, Check, X, Eye, EyeOff, Search, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface NetflixAccount {
  id: string;
  email: string;
  password: string;
  is_active: boolean;
  last_checked: string | null;
  last_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function AdminNetflixAccounts() {
  const { language } = useLanguage();
  const [accounts, setAccounts] = useState<NetflixAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    is_active: true,
    notes: ''
  });

  const texts = {
    title: {
      pt: 'Gerenciar Contas Netflix',
      en: 'Manage Netflix Accounts',
      es: 'Gestionar Cuentas Netflix'
    },
    description: {
      pt: 'Configure as contas Netflix para buscar códigos de login',
      en: 'Configure Netflix accounts to search for login codes',
      es: 'Configure cuentas de Netflix para buscar códigos de inicio de sesión'
    },
    addAccount: {
      pt: 'Adicionar Conta',
      en: 'Add Account',
      es: 'Agregar Cuenta'
    },
    email: {
      pt: 'Email',
      en: 'Email',
      es: 'Correo'
    },
    password: {
      pt: 'Senha',
      en: 'Password',
      es: 'Contraseña'
    },
    active: {
      pt: 'Ativa',
      en: 'Active',
      es: 'Activa'
    },
    notes: {
      pt: 'Notas (opcional)',
      en: 'Notes (optional)',
      es: 'Notas (opcional)'
    },
    save: {
      pt: 'Salvar',
      en: 'Save',
      es: 'Guardar'
    },
    cancel: {
      pt: 'Cancelar',
      en: 'Cancel',
      es: 'Cancelar'
    },
    search: {
      pt: 'Buscar contas...',
      en: 'Search accounts...',
      es: 'Buscar cuentas...'
    },
    checkCode: {
      pt: 'Buscar Código',
      en: 'Check Code',
      es: 'Buscar Código'
    },
    lastChecked: {
      pt: 'Última verificação',
      en: 'Last checked',
      es: 'Última verificación'
    },
    lastCode: {
      pt: 'Último código',
      en: 'Last code',
      es: 'Último código'
    },
    never: {
      pt: 'Nunca',
      en: 'Never',
      es: 'Nunca'
    },
    noAccounts: {
      pt: 'Nenhuma conta cadastrada',
      en: 'No accounts registered',
      es: 'No hay cuentas registradas'
    },
    deleteConfirm: {
      pt: 'Tem certeza que deseja excluir esta conta?',
      en: 'Are you sure you want to delete this account?',
      es: '¿Está seguro de que desea eliminar esta cuenta?'
    },
    status: {
      pt: 'Status',
      en: 'Status',
      es: 'Estado'
    },
    actions: {
      pt: 'Ações',
      en: 'Actions',
      es: 'Acciones'
    }
  };

  const t = (key: keyof typeof texts) => texts[key][language as keyof typeof texts[typeof key]];

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('netflix_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        const { error } = await supabase
          .from('netflix_accounts')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('netflix_accounts')
          .insert([formData]);

        if (error) throw error;
      }

      setFormData({ email: '', password: '', is_active: true, notes: '' });
      setShowAddForm(false);
      setEditingId(null);
      loadAccounts();
    } catch (error) {
      console.error('Error saving account:', error);
      alert('Erro ao salvar conta');
    }
  };

  const handleEdit = (account: NetflixAccount) => {
    setFormData({
      email: account.email,
      password: account.password,
      is_active: account.is_active,
      notes: account.notes || ''
    });
    setEditingId(account.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;

    try {
      const { error } = await supabase
        .from('netflix_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Erro ao excluir conta');
    }
  };

  const handleCheckCode = async (account: NetflixAccount) => {
    setCheckingId(account.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/find-netflix-code`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: account.email,
            password: account.password
          })
        }
      );

      const result = await response.json();

      if (result.success && result.latest_email) {
        await supabase
          .from('netflix_accounts')
          .update({
            last_checked: new Date().toISOString(),
            last_code: result.latest_email.login_code || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', account.id);

        loadAccounts();

        if (result.latest_email.login_code) {
          alert(`Código encontrado: ${result.latest_email.login_code}`);
        } else {
          alert('Nenhum código encontrado');
        }
      } else {
        alert('Erro ao buscar código');
      }
    } catch (error) {
      console.error('Error checking code:', error);
      alert('Erro ao buscar código');
    } finally {
      setCheckingId(null);
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const filteredAccounts = accounts.filter(account =>
    account.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (account.notes && account.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Mail className="h-8 w-8 text-red-600" />
              {t('title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('description')}
            </p>
          </div>
          <button
            onClick={() => {
              setShowAddForm(true);
              setEditingId(null);
              setFormData({ email: '', password: '', is_active: true, notes: '' });
            }}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-5 w-5" />
            {t('addAccount')}
          </button>
        </div>

        {showAddForm && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('email')}
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-800 dark:text-white"
                  placeholder="conta@netflix.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('password')}
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-800 dark:text-white"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('notes')}
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-800 dark:text-white"
                  rows={2}
                  placeholder="Notas sobre esta conta..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('active')}
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Check className="h-4 w-4" />
                  {t('save')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingId(null);
                    setFormData({ email: '', password: '', is_active: true, notes: '' });
                  }}
                  className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" />
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('search')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        {filteredAccounts.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            {t('noAccounts')}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAccounts.map((account) => (
              <div
                key={account.id}
                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  <div className="lg:col-span-3">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('email')}
                    </div>
                    <div className="text-gray-900 dark:text-white font-mono text-sm">
                      {account.email}
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('password')}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 dark:text-white font-mono text-sm">
                        {showPasswords[account.id] ? account.password : '••••••••'}
                      </span>
                      <button
                        onClick={() => togglePasswordVisibility(account.id)}
                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        {showPasswords[account.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('status')}
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      account.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                      {account.is_active ? t('active') : 'Inativa'}
                    </span>
                  </div>

                  <div className="lg:col-span-2">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('lastCode')}
                    </div>
                    <div className="text-gray-900 dark:text-white font-mono text-sm font-bold">
                      {account.last_code || '-'}
                    </div>
                  </div>

                  <div className="lg:col-span-3 flex items-center gap-2">
                    <button
                      onClick={() => handleCheckCode(account)}
                      disabled={checkingId === account.id}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
                    >
                      <RefreshCw className={`h-4 w-4 ${checkingId === account.id ? 'animate-spin' : ''}`} />
                      {t('checkCode')}
                    </button>
                    <button
                      onClick={() => handleEdit(account)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-lg transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(account.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {account.notes && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {account.notes}
                    </div>
                  </div>
                )}

                {account.last_checked && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {t('lastChecked')}: {new Date(account.last_checked).toLocaleString(language)}
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
