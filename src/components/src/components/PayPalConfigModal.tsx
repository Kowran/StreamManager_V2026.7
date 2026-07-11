import React, { useState, useEffect } from 'react';
import { X, Save, TestTube, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PayPalConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: PayPalConfig) => void;
}

interface PayPalConfig {
  client_id: string;
  client_secret: string;
  environment: 'sandbox' | 'production';
  webhook_id?: string;
}

export function PayPalConfigModal({ isOpen, onClose, onSave }: PayPalConfigModalProps) {
  const [config, setConfig] = useState<PayPalConfig>({
    client_id: '',
    client_secret: '',
    environment: 'sandbox'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'paypal_config')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading PayPal config:', error);
        return;
      }

      if (data?.value) {
        setConfig(data.value as PayPalConfig);
      }
    } catch (error) {
      console.error('Error loading PayPal config:', error);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('system_config')
        .upsert([{
          key: 'paypal_config',
          value: config,
          description: 'PayPal payment gateway configuration'
        }], {
          onConflict: 'key'
        });

      if (error) throw error;

      onSave(config);
      onClose();
    } catch (error) {
      console.error('Error saving PayPal config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-paypal-connection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config })
      });

      const result = await response.json();

      if (response.ok) {
        setTestResult({ success: true, message: 'PayPal connection successful!' });
      } else {
        setTestResult({ success: false, message: result.error || 'Connection failed' });
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to test connection' });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">PayPal Configuration</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Environment
            </label>
            <select
              value={config.environment}
              onChange={(e) => setConfig({ ...config, environment: e.target.value as 'sandbox' | 'production' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client ID
            </label>
            <input
              type="text"
              value={config.client_id}
              onChange={(e) => setConfig({ ...config, client_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter PayPal Client ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client Secret
            </label>
            <input
              type="password"
              value={config.client_secret}
              onChange={(e) => setConfig({ ...config, client_secret: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter PayPal Client Secret"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Webhook ID (Optional)
            </label>
            <input
              type="text"
              value={config.webhook_id || ''}
              onChange={(e) => setConfig({ ...config, webhook_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter PayPal Webhook ID"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              🔗 Webhook URL
            </h4>
            <div className="bg-white rounded-md p-3 border">
              <code className="text-xs text-gray-900 break-all">
                {import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-webhook
              </code>
            </div>
            <p className="mt-2 text-xs text-blue-700">
              Configure this URL in your PayPal dashboard to receive payment notifications
            </p>
          </div>

          {testResult && (
            <div className={`p-3 rounded-md flex items-center space-x-2 ${
              testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {testResult.success ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span className="text-sm">{testResult.message}</span>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              onClick={testConnection}
              disabled={isTesting || !config.client_id || !config.client_secret}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TestTube className="w-4 h-4" />
              <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isLoading || !config.client_id || !config.client_secret}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              <span>{isLoading ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}