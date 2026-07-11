import React, { useState, useEffect } from 'react';
import { X, Save, Coins, AlertCircle, CheckCircle, Eye, EyeOff, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface TripleAConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface TripleAConfig {
  client_id: string;
  client_secret: string;
  merchant_key: string;
  is_active: boolean;
  sandbox_mode: boolean;
}

export function TripleAConfigModal({ isOpen, onClose, onSave }: TripleAConfigModalProps) {
  const { t, language } = useLanguage();
  const [config, setConfig] = useState<TripleAConfig>({
    client_id: '',
    client_secret: '',
    merchant_key: '',
    is_active: false,
    sandbox_mode: true
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  async function loadConfig() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('triplea_config')
        .select('*')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setConfig({
          client_id: data.client_id || '',
          client_secret: data.client_secret || '',
          merchant_key: data.merchant_key || '',
          is_active: data.is_active || false,
          sandbox_mode: data.sandbox_mode ?? true
        });
      }
    } catch (error) {
      console.error('Error loading Triple-A config:', error);
      setError(language === 'pt' ? 'Erro ao carregar configurações do Triple-A' : 'Error loading Triple-A settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');

    try {
      if (!config.client_id.trim()) {
        throw new Error(language === 'pt' ? 'Client ID é obrigatório' : 'Client ID is required');
      }

      if (!config.client_secret.trim()) {
        throw new Error(language === 'pt' ? 'Client Secret é obrigatório' : 'Client Secret is required');
      }

      if (!config.merchant_key.trim()) {
        throw new Error(language === 'pt' ? 'Merchant Key é obrigatório' : 'Merchant Key is required');
      }

      const { data: existing } = await supabase
        .from('triplea_config')
        .select('id')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('triplea_config')
          .update({
            client_id: config.client_id,
            client_secret: config.client_secret,
            merchant_key: config.merchant_key,
            is_active: config.is_active,
            sandbox_mode: config.sandbox_mode,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('triplea_config')
          .insert({
            client_id: config.client_id,
            client_secret: config.client_secret,
            merchant_key: config.merchant_key,
            is_active: config.is_active,
            sandbox_mode: config.sandbox_mode
          });

        if (error) throw error;
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSave();
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Error saving config:', error);
      setError(error instanceof Error ? error.message : 'Error saving settings');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const translations = {
    title: language === 'pt' ? 'Configurações do Triple-A' : language === 'en' ? 'Triple-A Settings' : 'Configuración de Triple-A',
    loading: language === 'pt' ? 'Carregando configurações...' : 'Loading settings...',
    saved: language === 'pt' ? 'Configurações Salvas!' : 'Settings Saved!',
    savedMessage: language === 'pt' ? 'O Triple-A foi configurado com sucesso.' : 'Triple-A has been configured successfully.',
    activatePayment: language === 'pt' ? 'Ativar Triple-A como método de pagamento' : 'Activate Triple-A as payment method',
    sandboxMode: language === 'pt' ? 'Modo Sandbox (Teste)' : 'Sandbox Mode (Test)',
    apiCredentials: language === 'pt' ? 'Credenciais da API' : 'API Credentials',
    clientId: language === 'pt' ? 'Client ID *' : 'Client ID *',
    clientIdPlaceholder: language === 'pt' ? 'seu-client-id' : 'your-client-id',
    clientIdHint: language === 'pt' ? 'ID do cliente fornecido pelo Triple-A (ex: oaid-xxxxx)' : 'Client ID provided by Triple-A (ex: oaid-xxxxx)',
    clientSecret: language === 'pt' ? 'Client Secret *' : 'Client Secret *',
    clientSecretPlaceholder: language === 'pt' ? 'seu-client-secret' : 'your-client-secret',
    clientSecretHint: language === 'pt' ? 'Chave secreta do cliente' : 'Client secret key',
    merchantKey: language === 'pt' ? 'Merchant Key *' : 'Merchant Key *',
    merchantKeyPlaceholder: language === 'pt' ? 'sua-merchant-key' : 'your-merchant-key',
    merchantKeyHint: language === 'pt' ? 'Chave do comerciante (ex: mkey-xxxxx)' : 'Merchant key (ex: mkey-xxxxx)',
    webhookUrl: language === 'pt' ? 'URL do Webhook' : 'Webhook URL',
    webhookHint: language === 'pt' ? 'Configure esta URL no painel do Triple-A para receber notificações de pagamento' : 'Configure this URL in the Triple-A dashboard to receive payment notifications',
    howToConfigure: language === 'pt' ? 'Como Configurar o Triple-A' : 'How to Configure Triple-A',
    cancel: language === 'pt' ? 'Cancelar' : 'Cancel',
    saveSettings: language === 'pt' ? 'Salvar Configurações' : 'Save Settings',
    saving: language === 'pt' ? 'Salvando...' : 'Saving...',
    securityCritical: language === 'pt' ? 'Segurança Crítica' : 'Critical Security',
    securityTips: language === 'pt'
      ? ['NUNCA compartilhe suas credenciais', 'Use sempre HTTPS em produção', 'Mantenha as credenciais seguras', 'Configure webhooks para confirmação automática']
      : ['NEVER share your credentials', 'Always use HTTPS in production', 'Keep credentials secure', 'Configure webhooks for automatic confirmation'],
    supportedCrypto: language === 'pt' ? 'Criptomoedas Suportadas' : 'Supported Cryptocurrencies',
    cryptoList: language === 'pt'
      ? ['Bitcoin (BTC)', 'Ethereum (ETH)', 'USDC (Stablecoin)', 'USDT (Stablecoin)', 'E outras...', 'Conversão automática para fiat']
      : ['Bitcoin (BTC)', 'Ethereum (ETH)', 'USDC (Stablecoin)', 'USDT (Stablecoin)', 'And others...', 'Automatic fiat conversion'],
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 dark:bg-purple-900/20 p-2 rounded-lg">
              <Coins className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {translations.title}
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {translations.loading}
            </p>
          </div>
        ) : success ? (
          <div className="text-center py-8">
            <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {translations.saved}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {translations.savedMessage}
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

            <div className="space-y-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.is_active}
                  onChange={(e) => setConfig(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {translations.activatePayment}
                </span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.sandbox_mode}
                  onChange={(e) => setConfig(prev => ({ ...prev, sandbox_mode: e.target.checked }))}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {translations.sandboxMode}
                </span>
              </label>
            </div>

            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                {translations.apiCredentials}
              </h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {translations.clientId}
                </label>
                <input
                  type="text"
                  required
                  value={config.client_id}
                  onChange={(e) => setConfig(prev => ({ ...prev, client_id: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-mono text-sm"
                  placeholder={translations.clientIdPlaceholder}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {translations.clientIdHint}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {translations.clientSecret}
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    required
                    value={config.client_secret}
                    onChange={(e) => setConfig(prev => ({ ...prev, client_secret: e.target.value }))}
                    className="block w-full pr-10 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-mono text-sm"
                    placeholder={translations.clientSecretPlaceholder}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {translations.clientSecretHint}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {translations.merchantKey}
                </label>
                <input
                  type="text"
                  required
                  value={config.merchant_key}
                  onChange={(e) => setConfig(prev => ({ ...prev, merchant_key: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-purple-500 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-mono text-sm"
                  placeholder={translations.merchantKeyPlaceholder}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {translations.merchantKeyHint}
                </p>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                {translations.webhookUrl}
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded-md p-3 border">
                <code className="text-xs text-gray-900 dark:text-white break-all">
                  {import.meta.env.VITE_SUPABASE_URL}/functions/v1/triplea-webhook
                </code>
              </div>
              <p className="mt-2 text-xs text-blue-700 dark:text-blue-400">
                {translations.webhookHint}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                {translations.howToConfigure}
              </h4>
              <ol className="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
                <li>
                  <a href="https://developers.triple-a.io" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                    {language === 'pt' ? 'Acesse o Portal de Desenvolvedor Triple-A' : 'Access Triple-A Developer Portal'}
                  </a>
                </li>
                <li>{language === 'pt' ? 'Crie uma conta de comerciante' : 'Create a merchant account'}</li>
                <li>{language === 'pt' ? 'Obtenha seu Client ID e Client Secret' : 'Get your Client ID and Client Secret'}</li>
                <li>{language === 'pt' ? 'Obtenha seu Merchant Key' : 'Get your Merchant Key'}</li>
                <li>{language === 'pt' ? 'Configure o webhook com a URL acima' : 'Configure the webhook with the URL above'}</li>
                <li>{language === 'pt' ? 'Cole as credenciais nos campos acima' : 'Paste the credentials in the fields above'}</li>
                <li>{language === 'pt' ? 'Ative o Triple-A marcando a caixa de seleção' : 'Activate Triple-A by checking the box'}</li>
              </ol>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                {translations.securityCritical}
              </h4>
              <ul className="text-xs text-red-700 dark:text-red-400 space-y-1">
                {translations.securityTips.map((tip, index) => (
                  <li key={index}>{tip}</li>
                ))}
              </ul>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
                {translations.supportedCrypto}
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-green-700 dark:text-green-400">
                {translations.cryptoList.map((crypto, index) => (
                  <div key={index}>{crypto.startsWith('•') ? crypto : `• ${crypto}`}</div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-gray-200 dark:border-gray-600 space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
              >
                {translations.cancel}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 transition-colors flex items-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {translations.saving}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {translations.saveSettings}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
