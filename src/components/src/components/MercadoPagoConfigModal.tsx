import React, { useState, useEffect } from 'react';
import { X, Save, CreditCard, AlertCircle, CheckCircle, Eye, EyeOff, Shield, Key, Globe } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface MercadoPagoConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface MercadoPagoConfig {
  access_token: string;
  public_key: string;
  webhook_secret: string;
  test_mode: boolean;
}

export function MercadoPagoConfigModal({ isOpen, onClose, onSave }: MercadoPagoConfigModalProps) {
  const { t } = useLanguage();
  const [config, setConfig] = useState<MercadoPagoConfig>({
    access_token: '',
    public_key: '',
    webhook_secret: '',
    test_mode: true
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showSecrets, setShowSecrets] = useState({
    access_token: false,
    webhook_secret: false
  });

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  async function loadConfig() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'mercadopago_config')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.value) {
        setConfig(prev => ({ ...prev, ...data.value }));
      }
    } catch (error) {
      console.error('Error loading MercadoPago config:', error);
      setError('Erro ao carregar configurações do Mercado Pago');
    } finally {
      setLoading(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-mercadopago-connection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao testar conexão');
      }

      if (result.success) {
        alert('✅ Conexão com o Mercado Pago estabelecida com sucesso!');
      } else {
        throw new Error(result.error || 'Falha na conexão com o Mercado Pago');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setError(error instanceof Error ? error.message : 'Erro ao testar conexão');
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');

    try {
      // Validate required fields
      if (!config.access_token.trim()) {
        throw new Error('Access Token é obrigatório');
      }

      if (!config.public_key.trim()) {
        throw new Error('Public Key é obrigatória');
      }

      // Validate key formats
      if (config.test_mode) {
        if (!config.access_token.startsWith('TEST-')) {
          console.warn('Warning: Access Token should start with TEST- in test mode');
        }
        if (!config.public_key.startsWith('TEST-')) {
          console.warn('Warning: Public Key should start with TEST- in test mode');
        }
      } else {
        if (!config.access_token.startsWith('APP_USR-')) {
          console.warn('Warning: Access Token should start with APP_USR- in production mode');
        }
        if (!config.public_key.startsWith('APP_USR-')) {
          console.warn('Warning: Public Key should start with APP_USR- in production mode');
        }
      }

      // Save configuration
      const { error } = await supabase
        .from('system_config')
        .upsert({
          key: 'mercadopago_config',
          value: {
            ...config,
            configured: true,
            configured_at: new Date().toISOString()
          },
          description: 'Configurações do Mercado Pago para pagamentos PIX e cartão',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (error) throw error;

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSave();
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Error saving config:', error);
      setError(error instanceof Error ? error.message : 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  }

  const toggleSecretVisibility = (field: 'access_token' | 'webhook_secret') => {
    setShowSecrets(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg">
              <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Configurações do Mercado Pago
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
              Carregando configurações...
            </p>
          </div>
        ) : success ? (
          <div className="text-center py-8">
            <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Configurações Salvas!
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              O Mercado Pago foi configurado com sucesso.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
                </div>
              </div>
            )}

            {/* Mode Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Modo de Operação
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, test_mode: true }))}
                  className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                    config.test_mode
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Shield className="h-5 w-5 mx-auto mb-1" />
                  Modo de Teste (Sandbox)
                </button>
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, test_mode: false }))}
                  className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                    !config.test_mode
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Globe className="h-5 w-5 mx-auto mb-1" />
                  Modo de Produção
                </button>
              </div>
            </div>

            {/* API Keys */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                Credenciais da API
              </h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Public Key *
                </label>
                <input
                  type="text"
                  required
                  value={config.public_key}
                  onChange={(e) => setConfig(prev => ({ ...prev, public_key: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-mono text-sm"
                  placeholder={config.test_mode ? 'TEST-...' : 'APP_USR-...'}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Chave pública usada no frontend (segura para exposição)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Access Token *
                </label>
                <div className="relative">
                  <input
                    type={showSecrets.access_token ? 'text' : 'password'}
                    required
                    value={config.access_token}
                    onChange={(e) => setConfig(prev => ({ ...prev, access_token: e.target.value }))}
                    className="block w-full pr-10 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-mono text-sm"
                    placeholder={config.test_mode ? 'TEST-...' : 'APP_USR-...'}
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecretVisibility('access_token')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showSecrets.access_token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Token de acesso usado no backend (NUNCA exponha no frontend)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Webhook Secret
                </label>
                <div className="relative">
                  <input
                    type={showSecrets.webhook_secret ? 'text' : 'password'}
                    value={config.webhook_secret}
                    onChange={(e) => setConfig(prev => ({ ...prev, webhook_secret: e.target.value }))}
                    className="block w-full pr-10 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-mono text-sm"
                    placeholder="Webhook secret (opcional)"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecretVisibility('webhook_secret')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showSecrets.webhook_secret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Secret usado para verificar webhooks (opcional mas recomendado)
                </p>
              </div>
            </div>

            {/* Webhook URL */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                🔗 URL do Webhook
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded-md p-3 border">
                <code className="text-xs text-gray-900 dark:text-white break-all">
                  {import.meta.env.VITE_SUPABASE_URL}/functions/v1/mercadopago-webhook
                </code>
              </div>
              <p className="mt-2 text-xs text-blue-700 dark:text-blue-400">
                Configure esta URL no painel do Mercado Pago para receber notificações de pagamento
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                📋 Como Configurar o Mercado Pago
              </h4>
              <ol className="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
                <li>Acesse o <a href="https://www.mercadopago.com.br/developers" target="_blank" className="text-blue-600 hover:underline">Painel de Desenvolvedores</a></li>
                <li>Crie uma aplicação ou use uma existente</li>
                <li>Vá para "Credenciais" e copie a Public Key e Access Token</li>
                <li>Configure o webhook com a URL fornecida acima</li>
                <li>Selecione os eventos: payment.created, payment.updated</li>
                <li>Configure um webhook secret (opcional mas recomendado)</li>
                <li>Cole todas as credenciais nos campos acima</li>
                <li>Teste a conexão antes de ativar</li>
              </ol>
            </div>

            {/* Security Notice */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                🔒 Segurança Crítica
              </h4>
              <ul className="text-xs text-red-700 dark:text-red-400 space-y-1">
                <li>• NUNCA compartilhe seu Access Token</li>
                <li>• Use sempre HTTPS em produção</li>
                <li>• Mantenha as credenciais seguras e rotacione regularmente</li>
                <li>• Configure webhooks para confirmação automática</li>
                <li>• Monitore transações no painel do Mercado Pago</li>
              </ul>
            </div>

            {/* Supported Features */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
                💳 Recursos Suportados
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-green-700 dark:text-green-400">
                <div>• PIX (instantâneo)</div>
                <div>• Cartões de crédito</div>
                <div>• Cartões de débito</div>
                <div>• Parcelamento</div>
                <div>• Boleto bancário</div>
                <div>• Confirmação automática</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={testConnection}
                disabled={testing || !config.access_token || !config.public_key}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center"
              >
                {testing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Testando...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Testar Conexão
                  </>
                )}
              </button>

              <div className="flex items-center space-x-3">
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
                      Salvar Configurações
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}