import React, { useState, useEffect } from 'react';
import { X, Save, CreditCard, AlertCircle, CheckCircle, Eye, EyeOff, Key, Globe, Link } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface InfinitePayConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface InfinitePayConfig {
  api_key: string;
  handle: string;
}

export function InfinitePayConfigModal({ isOpen, onClose, onSave }: InfinitePayConfigModalProps) {
  const [config, setConfig] = useState<InfinitePayConfig>({
    api_key: '',
    handle: 'checkout',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

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
        .eq('key', 'infinitepay_config')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.value) {
        setConfig(prev => ({ ...prev, ...data.value }));
      }
    } catch (error) {
      console.error('Error loading InfinitePay config:', error);
      setError('Erro ao carregar configuracoes do InfinitePay');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');

    try {
      if (!config.api_key.trim()) {
        throw new Error('API Key e obrigatoria');
      }

      const { error } = await supabase
        .from('system_config')
        .upsert({
          key: 'infinitepay_config',
          value: {
            ...config,
            configured: true,
            configured_at: new Date().toISOString()
          },
          description: 'Configuracoes do InfinitePay para pagamentos PIX',
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-100 dark:bg-indigo-900/20 p-2 rounded-lg">
              <CreditCard className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Configuracoes do InfinitePay
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4"></div>
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
              O InfinitePay foi configurado com sucesso.
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

            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                Credenciais da API
              </h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Key *
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    required
                    value={config.api_key}
                    onChange={(e) => setConfig(prev => ({ ...prev, api_key: e.target.value }))}
                    className="block w-full pl-9 pr-10 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-mono text-sm"
                    placeholder="Sua API Key do InfinitePay"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Obtenha sua API Key no painel do InfinitePay em Configuracoes &gt; API
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Handle (Identificador do Checkout)
                </label>
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={config.handle}
                    onChange={(e) => setConfig(prev => ({ ...prev, handle: e.target.value }))}
                    className="block w-full pl-9 pr-3 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm"
                    placeholder="checkout"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  O handle do seu checkout InfinitePay (geralmente "checkout")
                </p>
              </div>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-indigo-800 dark:text-indigo-300 mb-2">
                URL do Webhook
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded-md p-3 border">
                <code className="text-xs text-gray-900 dark:text-white break-all">
                  {import.meta.env.VITE_SUPABASE_URL}/functions/v1/infinitepay-webhook
                </code>
              </div>
              <p className="mt-2 text-xs text-indigo-700 dark:text-indigo-400">
                Configure esta URL no painel do InfinitePay para receber notificacoes de pagamento
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Como Configurar o InfinitePay
              </h4>
              <ol className="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
                <li>Acesse o <a href="https://www.infinitepay.io" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Painel do InfinitePay</a></li>
                <li>Va para Configuracoes &gt; API e gere sua API Key</li>
                <li>Configure o webhook com a URL fornecida acima</li>
                <li>Cole a API Key no campo acima</li>
                <li>Salve as configuracoes</li>
              </ol>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                Seguranca Critica
              </h4>
              <ul className="text-xs text-red-700 dark:text-red-400 space-y-1">
                <li>- NUNCA compartilhe sua API Key</li>
                <li>- Use sempre HTTPS em producao</li>
                <li>- Mantenha as credenciais seguras e rotacione regularmente</li>
                <li>- Configure o webhook para confirmacao automatica</li>
              </ul>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
                Recursos Suportados
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-green-700 dark:text-green-400">
                <div>- PIX (instantaneo, taxa zero)</div>
                <div>- Cartao de credito (ate 12x)</div>
                <div>- Confirmacao automatica via webhook</div>
                <div>- Checkout hospedado pela InfinitePay</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors flex items-center"
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
        )}
      </div>
    </div>
  );
}
