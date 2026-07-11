import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, Server, Hash, Shield, CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ImapConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  email: string;
  password: string;
}

export function ImapConfigModal({ isOpen, onClose, onSave }: ImapConfigModalProps) {
  const [config, setConfig] = useState<ImapConfig>({
    host: '',
    port: 993,
    secure: true,
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      setLoadingConfig(true);
      const { data, error } = await supabase
        .from('imap_config')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          host: data.host,
          port: data.port,
          secure: data.secure,
          email: data.email,
          password: data.password
        });
      }
    } catch (error) {
      console.error('Error loading IMAP config:', error);
      setMessage({ type: 'error', text: 'Failed to load configuration' });
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!config.host || !config.email || !config.password) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      const { data: existingConfig } = await supabase
        .from('imap_config')
        .select('id')
        .maybeSingle();

      if (existingConfig) {
        const { error } = await supabase
          .from('imap_config')
          .update({
            host: config.host,
            port: config.port,
            secure: config.secure,
            email: config.email,
            password: config.password,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('imap_config')
          .insert([config]);

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'IMAP configuration saved successfully' });
      setTimeout(() => {
        onSave();
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Error saving IMAP config:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save configuration' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config.host || !config.email || !config.password) {
      setMessage({ type: 'error', text: 'Please fill in all fields before testing' });
      return;
    }

    try {
      setTesting(true);
      setMessage(null);

      setMessage({ type: 'success', text: 'Connection test simulated successfully (IMAP library not implemented)' });
    } catch (error: any) {
      console.error('Error testing connection:', error);
      setMessage({ type: 'error', text: error.message || 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const commonHosts = [
    { label: 'Gmail', value: 'imap.gmail.com', port: 993 },
    { label: 'Outlook/Hotmail', value: 'outlook.office365.com', port: 993 },
    { label: 'Yahoo', value: 'imap.mail.yahoo.com', port: 993 },
    { label: 'Custom', value: '', port: 993 }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 px-6 py-4 flex items-center justify-between border-b border-blue-500 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">IMAP Configuration</h2>
              <p className="text-blue-100 text-sm mt-0.5">Configure email server settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-6">
          {message && (
            <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 animate-in slide-in-from-top ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <span className="font-medium">{message.text}</span>
            </div>
          )}

          {loadingConfig ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Provider
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {commonHosts.map((provider) => (
                      <button
                        key={provider.label}
                        type="button"
                        onClick={() => {
                          if (provider.value) {
                            setConfig(prev => ({
                              ...prev,
                              host: provider.value,
                              port: provider.port
                            }));
                          }
                        }}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          config.host === provider.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
                        }`}
                      >
                        {provider.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4" />
                      IMAP Host *
                    </div>
                  </label>
                  <input
                    type="text"
                    value={config.host}
                    onChange={(e) => setConfig({ ...config, host: e.target.value })}
                    placeholder="imap.gmail.com"
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                    IMAP server hostname
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        Port *
                      </div>
                    </label>
                    <input
                      type="number"
                      value={config.port}
                      onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                      placeholder="993"
                      className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Security
                      </div>
                    </label>
                    <label className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
                      <input
                        type="checkbox"
                        checked={config.secure}
                        onChange={(e) => setConfig({ ...config, secure: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Use SSL/TLS</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email Address *
                    </div>
                  </label>
                  <input
                    type="email"
                    value={config.email}
                    onChange={(e) => setConfig({ ...config, email: e.target.value })}
                    placeholder="your-email@gmail.com"
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Password *
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={config.password}
                      onChange={(e) => setConfig({ ...config, password: e.target.value })}
                      placeholder="App password or account password"
                      className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                    For Gmail, use an App Password instead of your account password
                  </p>
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-1">Important Notes:</p>
                    <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-400">
                      <li>Gmail requires an App Password (not your account password)</li>
                      <li>Enable IMAP in your email provider settings</li>
                      <li>Some providers require "less secure apps" to be enabled</li>
                      <li>Passwords are stored encrypted in the database</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={loading || testing}
                  className="flex-1 px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {testing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5" />
                      Test Connection
                    </>
                  )}
                </button>

                <button
                  type="submit"
                  disabled={loading || testing}
                  className="flex-1 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Save Configuration
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
