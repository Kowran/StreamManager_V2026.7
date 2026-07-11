import React, { useState, useEffect } from 'react';
import { X, Bell, Save, Settings, Shield, Package, CreditCard, MessageCircle, Calendar, AlertTriangle } from 'lucide-react';
import { NotificationAPI, NotificationPreferences } from '../lib/notificationApi';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationPreferencesModal({ isOpen, onClose }: NotificationPreferencesModalProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadPreferences();
    }
  }, [isOpen, user]);

  async function loadPreferences() {
    if (!user) return;

    setLoading(true);
    try {
      const data = await NotificationAPI.getPreferences(user.id);
      setPreferences(data || {
        id: '',
        user_id: user.id,
        account_expiry_enabled: true,
        delivery_enabled: true,
        payment_enabled: true,
        support_enabled: true,
        system_enabled: true,
        admin_enabled: true,
        accounts_access_expiry_enabled: true,
        email_notifications: false,
        push_notifications: false,
        created_at: '',
        updated_at: ''
      });
    } catch (error) {
      console.error('Error loading preferences:', error);
      setError('Erro ao carregar preferências');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!user || !preferences) return;

    setSaving(true);
    setError('');

    try {
      const success = await NotificationAPI.updatePreferences(user.id, {
        account_expiry_enabled: preferences.account_expiry_enabled,
        delivery_enabled: preferences.delivery_enabled,
        payment_enabled: preferences.payment_enabled,
        support_enabled: preferences.support_enabled,
        system_enabled: preferences.system_enabled,
        admin_enabled: preferences.admin_enabled,
        accounts_access_expiry_enabled: preferences.accounts_access_expiry_enabled,
        email_notifications: preferences.email_notifications,
        push_notifications: preferences.push_notifications
      });

      if (success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 2000);
      } else {
        setError('Erro ao salvar preferências');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      setError('Erro ao salvar preferências');
    } finally {
      setSaving(false);
    }
  }

  const updatePreference = (key: keyof NotificationPreferences, value: boolean) => {
    if (!preferences) return;
    setPreferences(prev => prev ? { ...prev, [key]: value } : null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg">
              <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Configurações de Notificação
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Carregando preferências...
            </p>
          </div>
        ) : success ? (
          <div className="text-center py-8">
            <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Save className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Preferências Salvas!
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Suas configurações de notificação foram atualizadas.
            </p>
          </div>
        ) : preferences ? (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
                </div>
              </div>
            )}

            {/* Notification Types */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Tipos de Notificação
              </h4>
              <div className="space-y-4">
                {/* Account Expiry */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                        Expiração de Contas
                      </h5>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Avisos quando suas contas de streaming estão próximas do vencimento
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.account_expiry_enabled}
                      onChange={(e) => updatePreference('account_expiry_enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Accounts Access Expiry */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                        Expiração do Acesso ao Gerenciador
                      </h5>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Avisos quando seu acesso ao gerenciador de contas está expirando
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.accounts_access_expiry_enabled}
                      onChange={(e) => updatePreference('accounts_access_expiry_enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Delivery */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                        Entregas de Produtos
                      </h5>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Confirmações quando seus produtos são entregues
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.delivery_enabled}
                      onChange={(e) => updatePreference('delivery_enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Payment */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                        Pagamentos e Recargas
                      </h5>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Confirmações de pagamentos e recargas de crédito
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.payment_enabled}
                      onChange={(e) => updatePreference('payment_enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Support */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <MessageCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                        Suporte e Atendimento
                      </h5>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Respostas e atualizações dos seus tickets de suporte
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.support_enabled}
                      onChange={(e) => updatePreference('support_enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* System */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                        Sistema e Manutenção
                      </h5>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Avisos sobre manutenção, atualizações e mudanças no sistema
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.system_enabled}
                      onChange={(e) => updatePreference('system_enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Admin */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                        Ações Administrativas
                      </h5>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Notificações sobre ações administrativas em sua conta
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.admin_enabled}
                      onChange={(e) => updatePreference('admin_enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Delivery Methods (Future) */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Métodos de Entrega (Em Breve)
              </h4>
              <div className="space-y-4 opacity-50">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                        Notificações por Email
                      </h5>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Receber notificações importantes por email
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.email_notifications}
                      onChange={(e) => updatePreference('email_notifications', e.target.checked)}
                      className="sr-only peer"
                      disabled
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Bell className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                        Notificações Push
                      </h5>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Notificações push no navegador (requer permissão)
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.push_notifications}
                      onChange={(e) => updatePreference('push_notifications', e.target.checked)}
                      className="sr-only peer"
                      disabled
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                ℹ️ Sobre as Notificações
              </h4>
              <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                <li>• As notificações são sincronizadas em tempo real</li>
                <li>• Notificações urgentes sempre reproduzem som</li>
                <li>• Você pode desativar tipos específicos de notificação</li>
                <li>• Notificações expiram automaticamente após o período definido</li>
                <li>• Suas preferências são salvas automaticamente</li>
              </ul>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Preferências
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}