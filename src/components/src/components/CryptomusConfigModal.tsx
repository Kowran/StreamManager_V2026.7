import React, { useState, useEffect } from 'react';
import { X, Save, Coins, AlertCircle, CheckCircle, Eye, EyeOff, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CryptomusConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface CryptomusConfig {
  merchant_id: string;
  api_secret: string;
  is_active: boolean;
}

export function CryptomusConfigModal({ isOpen, onClose, onSave }: CryptomusConfigModalProps) {
  const [config, setConfig] = useState<CryptomusConfig>({
    merchant_id: '',
    api_secret: '',
    is_active: false
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
        .from('cryptomus_config')
        .select('*')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setConfig({
          merchant_id: data.merchant_id || '',
          api_secret: data.api_secret || '',
          is_active: data.is_active || false
        });
      }
    } catch (error) {
      console.error('Error loading Cryptomus config:', error);
      setError('Erro ao carregar configurações do Cryptomus');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');

    try {
      if (!config.merchant_id.trim()) {
        throw new Error('Merchant ID é obrigatório');
      }

      if (!config.api_secret.trim()) {
        throw new Error('API Secret é obrigatória');
      }

      const { data: existing } = await supabase
        .from('cryptomus_config')
        .select('id')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('cryptomus_config')
          .update({
            merchant_id: config.merchant_id,
            api_secret: config.api_secret,
            is_active: config.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cryptomus_config')
          .insert({
            merchant_id: config.merchant_id,
            api_secret: config.api_secret,
            is_active: config.is_active
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
      setError(error instanceof Error ? error.message : 'Erro ao salvar configurações');
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
            <div className="bg-orange-100 dark:bg-orange-900/20 p-2 rounded-lg">
              <Coins className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Configurações do Cryptomus
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
              O Cryptomus foi configurado com sucesso.
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

            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.is_active}
                  onChange={(e) => setConfig(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ativar Cryptomus como método de pagamento
                </span>
              </label>
            </div>

            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                Credenciais da API
              </h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Merchant ID *
                </label>
                <input
                  type="text"
                  required
                  value={config.merchant_id}
                  onChange={(e) => setConfig(prev => ({ ...prev, merchant_id: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-mono text-sm"
                  placeholder="seu-merchant-id"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  ID do comerciante fornecido pelo Cryptomus
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Secret *
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    required
                    value={config.api_secret}
                    onChange={(e) => setConfig(prev => ({ ...prev, api_secret: e.target.value }))}
                    className="block w-full pr-10 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-orange-500 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 font-mono text-sm"
                    placeholder="sua-api-secret"
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
                  Chave secreta da API (NUNCA exponha no frontend)
                </p>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                🔗 URL do Webhook
              </h4>
              <div className="bg-white dark:bg-gray-800 rounded-md p-3 border">
                <code className="text-xs text-gray-900 dark:text-white break-all">
                  {import.meta.env.VITE_SUPABASE_URL}/functions/v1/cryptomus-webhook
                </code>
              </div>
              <p className="mt-2 text-xs text-blue-700 dark:text-blue-400">
                Configure esta URL no painel do Cryptomus para receber notificações de pagamento
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                📋 Como Configurar o Cryptomus
              </h4>
              <ol className="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
                <li>Acesse o <a href="https://cryptomus.com/personal" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">Dashboard do Cryptomus</a></li>
                <li>Crie ou acesse sua conta de merchant</li>
                <li>Vá para "API" ou "Configurações"</li>
                <li>Copie o "Merchant ID"</li>
                <li>Gere ou copie o "Payment API Key"</li>
                <li>Configure o webhook com a URL fornecida acima</li>
                <li>Cole as credenciais nos campos acima</li>
                <li>Ative o Cryptomus marcando a caixa de seleção</li>
              </ol>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                🔒 Segurança Crítica
              </h4>
              <ul className="text-xs text-red-700 dark:text-red-400 space-y-1">
                <li>• NUNCA compartilhe sua API Secret</li>
                <li>• Use sempre HTTPS em produção</li>
                <li>• Mantenha as credenciais seguras</li>
                <li>• Configure webhooks para confirmação automática</li>
                <li>• Monitore transações no dashboard do Cryptomus</li>
              </ul>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
                💰 Criptomoedas Suportadas
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-green-700 dark:text-green-400">
                <div>• Bitcoin (BTC)</div>
                <div>• Ethereum (ETH)</div>
                <div>• USDT (TRC20, ERC20)</div>
                <div>• Litecoin (LTC)</div>
                <div>• Bitcoin Cash (BCH)</div>
                <div>• Tron (TRX)</div>
                <div>• E muitas outras...</div>
                <div>• Confirmação automática</div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t border-gray-200 dark:border-gray-600 space-x-3">
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
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 transition-colors flex items-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
        )}
      </div>
    </div>
  );
}
