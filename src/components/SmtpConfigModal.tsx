import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, Server, Hash, Shield, CheckCircle, AlertCircle, Loader2, Eye, EyeOff, Send, Power } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SmtpConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  enabled: boolean;
}

const emptyConfig: SmtpConfig = {
  host: '',
  port: 587,
  secure: false,
  username: '',
  password: '',
  from_email: '',
  from_name: 'Marketplace',
  enabled: true,
};

export function SmtpConfigModal({ isOpen, onClose, onSave }: SmtpConfigModalProps) {
  const [config, setConfig] = useState<SmtpConfig>(emptyConfig);
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
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
        .from('smtp_config')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          host: data.host,
          port: data.port,
          secure: data.secure,
          username: data.username,
          password: data.password,
          from_email: data.from_email,
          from_name: data.from_name,
          enabled: data.enabled,
        });
      }
    } catch (error) {
      console.error('Error loading SMTP config:', error);
      setMessage({ type: 'error', text: 'Failed to load configuration' });
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!config.host || !config.username || !config.password || !config.from_email) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      const { data: existingConfig } = await supabase
        .from('smtp_config')
        .select('id')
        .maybeSingle();

      if (existingConfig) {
        const { error } = await supabase
          .from('smtp_config')
          .update({
            host: config.host,
            port: config.port,
            secure: config.secure,
            username: config.username,
            password: config.password,
            from_email: config.from_email,
            from_name: config.from_name,
            enabled: config.enabled,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingConfig.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('smtp_config')
          .insert([config]);

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'SMTP configuration saved successfully' });
      setTimeout(() => {
        onSave();
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Error saving SMTP config:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save configuration' });
    } finally {
      setLoading(false);
    }
  };

  const commonHosts = [
    { label: 'Gmail', value: 'smtp.gmail.com', port: 587, secure: false },
    { label: 'Outlook/Hotmail', value: 'smtp.office365.com', port: 587, secure: false },
    { label: 'Yahoo', value: 'smtp.mail.yahoo.com', port: 587, secure: false },
    { label: 'Custom', value: '', port: 587, secure: false },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-700 dark:to-emerald-800 px-6 py-4 flex items-center justify-between border-b border-emerald-500 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Send className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">SMTP Configuration</h2>
              <p className="text-emerald-100 text-sm mt-0.5">Configure outgoing email server for seller notifications</p>
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
              <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
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
                              port: provider.port,
                              secure: provider.secure,
                            }));
                          }
                        }}
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          config.host === provider.value
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                            : 'border-gray-300 dark:border-gray-600 hover:border-emerald-300 dark:hover:border-emerald-600'
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
                      SMTP Host *
                    </div>
                  </label>
                  <input
                    type="text"
                    value={config.host}
                    onChange={(e) => setConfig({ ...config, host: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
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
                      onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 587 })}
                      placeholder="587"
                      className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Use SSL/TLS (port 465)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      SMTP Username *
                    </div>
                  </label>
                  <input
                    type="text"
                    value={config.username}
                    onChange={(e) => setConfig({ ...config, username: e.target.value })}
                    placeholder="your-email@gmail.com"
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      SMTP Password *
                    </div>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={config.password}
                      onChange={(e) => setConfig({ ...config, password: e.target.value })}
                      placeholder="App password or account password"
                      className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent pr-12"
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        From Email *
                      </div>
                    </label>
                    <input
                      type="email"
                      value={config.from_email}
                      onChange={(e) => setConfig({ ...config, from_email: e.target.value })}
                      placeholder="noreply@marketplace.com"
                      className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      From Name
                    </label>
                    <input
                      type="text"
                      value={config.from_name}
                      onChange={(e) => setConfig({ ...config, from_name: e.target.value })}
                      placeholder="Marketplace"
                      className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/30">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-2 focus:ring-emerald-500"
                  />
                  <Power className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    Enable seller sale email notifications
                  </span>
                </label>
              </div>

              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-emerald-800 dark:text-emerald-300">
                    <p className="font-medium mb-1">Important Notes:</p>
                    <ul className="list-disc list-inside space-y-1 text-emerald-700 dark:text-emerald-400">
                      <li>Gmail requires an App Password (not your account password)</li>
                      <li>Use port 587 with STARTTLS (secure=false) or port 465 with SSL (secure=true)</li>
                      <li>When enabled, sellers receive an email in their account language (pt/en/es) on every sale</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
