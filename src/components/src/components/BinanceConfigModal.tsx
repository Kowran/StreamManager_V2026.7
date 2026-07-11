import React, { useState, useEffect } from 'react';
import { X, Save, Key, Shield, Building2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface BinanceConfigModalProps {
  onClose: () => void;
  onSave: () => void;
}

interface BinanceConfig {
  id?: string;
  api_key: string;
  api_secret: string;
  merchant_id: string;
  is_active: boolean;
}

export function BinanceConfigModal({ onClose, onSave }: BinanceConfigModalProps) {
  const [config, setConfig] = useState<BinanceConfig>({
    api_key: '',
    api_secret: '',
    merchant_id: '',
    is_active: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('binance_config')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data);
      }
    } catch (err) {
      console.error('Error loading Binance config:', err);
      setError('Falha ao carregar configuração');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      if (!config.api_key || !config.api_secret || !config.merchant_id) {
        setError('Preencha todos os campos obrigatórios');
        return;
      }

      if (config.id) {
        const { error } = await supabase
          .from('binance_config')
          .update({
            api_key: config.api_key,
            api_secret: config.api_secret,
            merchant_id: config.merchant_id,
            is_active: config.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('binance_config')
          .insert([{
            api_key: config.api_key,
            api_secret: config.api_secret,
            merchant_id: config.merchant_id,
            is_active: config.is_active,
          }]);

        if (error) throw error;
      }

      setSuccess('Configuração salva com sucesso!');
      setTimeout(() => {
        onSave();
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error saving Binance config:', err);
      setError('Falha ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Key className="w-5 h-5 text-yellow-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Configuração Binance Pay
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              {success}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  API Key
                </div>
              </label>
              <input
                type="text"
                value={config.api_key}
                onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                placeholder="Digite sua Binance API Key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  API Secret
                </div>
              </label>
              <div className="relative">
                <input
                  type={showApiSecret ? 'text' : 'password'}
                  value={config.api_secret}
                  onChange={(e) => setConfig({ ...config, api_secret: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent pr-12"
                  placeholder="Digite seu Binance API Secret"
                />
                <button
                  type="button"
                  onClick={() => setShowApiSecret(!showApiSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showApiSecret ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Merchant ID
                </div>
              </label>
              <input
                type="text"
                value={config.merchant_id}
                onChange={(e) => setConfig({ ...config, merchant_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                placeholder="Digite seu Binance Merchant ID"
              />
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="binance-enabled"
                checked={config.is_active}
                onChange={(e) => setConfig({ ...config, is_active: e.target.checked })}
                className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
              />
              <label htmlFor="binance-enabled" className="text-sm text-gray-700 font-medium">
                Habilitar pagamentos via Binance Pay
              </label>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
              🔗 URL do Webhook
            </h4>
            <div className="bg-white dark:bg-gray-800 rounded-md p-3 border">
              <code className="text-xs text-gray-900 dark:text-white break-all">
                {import.meta.env.VITE_SUPABASE_URL}/functions/v1/binance-webhook
              </code>
            </div>
            <p className="mt-2 text-xs text-blue-700 dark:text-blue-400">
              Configure esta URL no painel do Binance Pay para receber notificações de pagamento
            </p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Instruções</h3>
            <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
              <li>Acesse sua conta Binance Merchant</li>
              <li>Vá para API Management e crie uma nova API Key</li>
              <li>Copie sua API Key, API Secret e Merchant ID</li>
              <li>Configure o webhook com a URL fornecida acima</li>
              <li>Cole as credenciais nos campos acima e salve</li>
            </ol>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Configuração
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}