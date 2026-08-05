import React, { useState, useEffect } from 'react';
import { X, Save, CreditCard, AlertCircle, CheckCircle, Eye, EyeOff, Shield, Globe, Wifi, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface EfiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface EfiConfig {
  client_id: string;
  client_secret: string;
  pix_key: string;
  test_mode: boolean;
  webhook_token: string;
}

export function EfiConfigModal({ isOpen, onClose, onSave }: EfiConfigModalProps) {
  const { t } = useLanguage();
  const [config, setConfig] = useState<EfiConfig>({
    client_id: '',
    client_secret: '',
    pix_key: '',
    test_mode: true,
    webhook_token: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showSecrets, setShowSecrets] = useState({
    client_secret: false,
    webhook_token: false,
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
        .eq('key', 'efi_config')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.value) {
        setConfig(prev => ({ ...prev, ...data.value }));
      }
    } catch (error) {
      console.error('Error loading EFI config:', error);
      setError('Erro ao carregar configuracoes da EFI Bank');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');

    try {
      if (!config.client_id.trim() || !config.client_secret.trim()) {
        throw new Error('Client ID e Client Secret sao obrigatorios');
      }
      if (!config.pix_key.trim()) {
        throw new Error('Chave PIX e obrigatoria');
      }

      const { error } = await supabase
        .from('system_config')
        .upsert({
          key: 'efi_config',
          value: {
            ...config,
            configured: true,
            configured_at: new Date().toISOString()
          },
          description: 'Configuracoes da EFI Bank para pagamentos PIX e boleto',
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
      setError(error instanceof Error ? error.message : 'Erro ao salvar configuracoes');
    } finally {
      setSaving(false);
    }
  }

  async function testEfiConnection() {
    setTesting(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-efi-connection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Erro ao testar conexão');
      }

      if (result.success) {
        const mode = result.details?.is_production ? 'Produção' : 'Sandbox';
        alert(`Conexão com a EFI Bank estabelecida com sucesso!\n\nModo: ${mode}\nOAuth: ${result.details?.oauth_url || '-'}\nStatus: ${result.details?.status || 'Conectado'}`);
      } else {
        throw new Error(result.error || 'Falha na conexão com a EFI Bank');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      setError(error instanceof Error ? error.message : 'Erro ao testar conexão');
    } finally {
      setTesting(false);
    }
  }

  const toggleSecretVisibility = (field: 'client_secret' | 'webhook_token') => {
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
            <div className="bg-orange-100 dark:bg-orange-900/20 p-2 rounded-lg">
              <CreditCard className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Configuracoes da EFI Bank
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Carregando configuracoes...
            </p>
          </div>
        ) : success ? (
          <div className="text-center py-8">
            <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Configuracoes Salvas!
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              A EFI Bank foi configurada com sucesso.
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
                Modo de Operacao
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, test_mode: true }))}
                  className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                    config.test_mode
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Shield className="h-5 w-5 mx-auto mb-1" />
                  Modo de Teste (Homologacao)
                </button>
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({ ...prev, test_mode: false }))}
                  className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                    !config.test_mode
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Globe className="h-5 w-5 mx-auto mb-1" />
                  Modo de Producao
                </button>
              </div>
            </div>

            {/* API Credentials */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                Credenciais da API
              </h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client ID *
                </label>
                <input
                  type="text"
                  required
                  value={config.client_id}
                  onChange={(e) => setConfig(prev => ({ ...prev, client_id: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-mono text-sm"
                  placeholder="Client ID da aplicacao EFI"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Obtenha no painel da EFI Bank em Aplicacoes - sua aplicacao
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client Secret *
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type={showSecrets.client_secret ? 'text' : 'password'}
                    required
                    value={config.client_secret}
                    onChange={(e) => setConfig(prev => ({ ...prev, client_secret: e.target.value }))}
                    className="block w-full pl-9 pr-10 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-mono text-sm"
                    placeholder="Client Secret da aplicacao EFI"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecretVisibility('client_secret')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showSecrets.client_secret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Chave PIX *
                </label>
                <input
                  type="text"
                  required
                  value={config.pix_key}
                  onChange={(e) => setConfig(prev => ({ ...prev, pix_key: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-mono text-sm"
                  placeholder="Sua chave PIX cadastrada na EFI Bank"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Pode ser CPF, CNPJ, email, telefone ou chave aleatoria cadastrada na EFI
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Webhook Token
                </label>
                <div className="relative">
                  <input
                    type={showSecrets.webhook_token ? 'text' : 'password'}
                    value={config.webhook_token}
                    onChange={(e) => setConfig(prev => ({ ...prev, webhook_token: e.target.value }))}
                    className="block w-full pr-10 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-mono text-sm"
                    placeholder="Token de verificacao do webhook (opcional)"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecretVisibility('webhook_token')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showSecrets.webhook_token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Token enviado como parametro ?token= na URL do webhook para verificacao (opcional mas recomendado)
                </p>
              </div>
            </div>

            {/* Webhook URL */}
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-2">
                URL do Webhook
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded-md p-3 border">
                <code className="text-xs text-gray-900 dark:text-white break-all">
                  {import.meta.env.VITE_SUPABASE_URL}/functions/v1/efi-webhook
                </code>
              </div>
              <p className="mt-2 text-xs text-orange-700 dark:text-orange-400">
                Configure esta URL no painel da EFI Bank para receber notificacoes de pagamento PIX
              </p>
            </div>

            {/* Instructions */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Como Configurar a EFI Bank
              </h4>
              <ol className="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
                <li>Acesse o <a href="https://dev.efipay.com.br" target="_blank" className="text-orange-600 hover:underline">Portal do Desenvolvedor EFI Bank</a></li>
                <li>Crie uma nova aplicacao no painel</li>
                <li>Selecione o escopo de PIX (cob.write, cob.read, pix.read)</li>
                <li>Copie o Client ID e Client Secret</li>
                <li>Cadastre uma chave PIX na sua conta EFI</li>
                <li>Cole as credenciais nos campos acima</li>
                <li>Configure o webhook PIX com a URL fornecida acima</li>
                <li>Salve as configuracoes</li>
              </ol>
            </div>

            {/* Security Notice */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                Seguranca Critica
              </h4>
              <ul className="text-xs text-red-700 dark:text-red-400 space-y-1">
                <li>- NUNCA compartilhe seu Client Secret</li>
                <li>- Use sempre HTTPS em producao</li>
                <li>- Mantenha as credenciais seguras e rotacione regularmente</li>
                <li>- Configure webhooks PIX para confirmacao automatica</li>
                <li>- Monitore transacoes no painel da EFI Bank</li>
              </ul>
            </div>

            {/* Supported Features */}
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-2">
                Recursos Suportados
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-orange-700 dark:text-orange-400">
                <div>- PIX (instantaneo)</div>
                <div>- Boleto bancario</div>
                <div>- Confirmacao automatica</div>
                <div>- Webhook PIX em tempo real</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={testEfiConnection}
                disabled={testing || !config.client_id || !config.client_secret}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center"
              >
                {testing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Testando...
                  </>
                ) : (
                  <>
                    <Wifi className="h-4 w-4 mr-2" />
                    Testar Conexao
                  </>
                )}
              </button>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Configuracoes
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
