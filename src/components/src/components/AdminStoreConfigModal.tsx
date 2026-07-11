import React, { useState, useEffect } from 'react';
import { X, Save, Store, Globe, Instagram, Facebook, MessageCircle, Twitter, Youtube, Linkedin, AlertCircle, CheckCircle, Upload, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface AdminStoreConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

interface StoreConfig {
  store_name: string;
  store_logo_url: string;
  store_description: string;
  copyright: string;
  store_banners?: CarouselBanner[];
  social_links: {
    instagram: string;
    facebook: string;
    whatsapp: string;
    twitter: string;
    youtube: string;
    linkedin: string;
    website: string;
  };
  contact_info: {
    email: string;
    phone: string;
    address: string;
  };
}

interface CarouselBanner {
  id: string;
  title: string;
  description: string;
  image_url: string;
  link_url?: string;
  button_text?: string;
  active: boolean;
  order: number;
}

export function AdminStoreConfigModal({ isOpen, onClose, onSave }: AdminStoreConfigModalProps) {
  const { t } = useLanguage();
  const [config, setConfig] = useState<StoreConfig>({
    store_name: 'StreamManager Store',
    store_logo_url: '',
    store_description: 'Sua loja de streaming premium',
    copyright: '© 2025 StreamManager. Todos os direitos reservados.',
    store_banners: [],
    social_links: {
      instagram: '',
      facebook: '',
      whatsapp: '+5584996105167',
      twitter: '',
      youtube: '',
      linkedin: '',
      website: ''
    },
    contact_info: {
      email: 'contato@streammanager.com',
      phone: '+5584996105167',
      address: ''
    }
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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
        .eq('key', 'store_config')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data?.value) {
        setConfig(prev => ({ ...prev, ...data.value }));
      }
    } catch (error) {
      console.error('Error loading store config:', error);
      setError('Erro ao carregar configurações da loja');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');

    try {
      // Validate required fields
      if (!config.store_name.trim()) {
        throw new Error('Nome da loja é obrigatório');
      }

      // Validate URLs if provided
      const urlFields = [
        { field: 'store_logo_url', name: 'Logo da loja' },
        { field: 'website', name: 'Website', isNested: true }
      ];

      for (const { field, name, isNested } of urlFields) {
        const value = isNested 
          ? config.social_links[field as keyof typeof config.social_links]
          : config[field as keyof StoreConfig];
        
        if (value && typeof value === 'string' && value.trim() && !value.startsWith('http')) {
          throw new Error(`${name} deve começar com http:// ou https://`);
        }
      }

      // Validate email format
      if (config.contact_info.email && !config.contact_info.email.includes('@')) {
        throw new Error('Email inválido');
      }

      // Save configuration
      const { error } = await supabase
        .from('system_config')
        .upsert({
          key: 'store_config',
          value: config,
          description: 'Configurações da loja e redes sociais',
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

  const getSocialIcon = (platform: string) => {
    switch (platform) {
      case 'instagram': return <Instagram className="h-4 w-4" />;
      case 'facebook': return <Facebook className="h-4 w-4" />;
      case 'whatsapp': return <MessageCircle className="h-4 w-4" />;
      case 'twitter': return <Twitter className="h-4 w-4" />;
      case 'youtube': return <Youtube className="h-4 w-4" />;
      case 'linkedin': return <Linkedin className="h-4 w-4" />;
      case 'website': return <Globe className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  const getSocialPlaceholder = (platform: string) => {
    switch (platform) {
      case 'instagram': return 'https://instagram.com/seuusuario';
      case 'facebook': return 'https://facebook.com/suapagina';
      case 'whatsapp': return '+5584996105167';
      case 'twitter': return 'https://twitter.com/seuusuario';
      case 'youtube': return 'https://youtube.com/seucanal';
      case 'linkedin': return 'https://linkedin.com/company/suaempresa';
      case 'website': return 'https://seusite.com';
      default: return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-lg">
              <Store className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Configurações da Loja
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
              As configurações da loja foram atualizadas com sucesso.
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

            {/* Store Branding */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                Identidade da Loja
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome da Loja *
                  </label>
                  <input
                    type="text"
                    required
                    value={config.store_name}
                    onChange={(e) => setConfig(prev => ({ ...prev, store_name: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="StreamManager Store"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Copyright *
                  </label>
                  <input
                    type="text"
                    required
                    value={config.copyright}
                    onChange={(e) => setConfig(prev => ({ ...prev, copyright: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="© 2025 StreamManager. Todos os direitos reservados."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    URL do Logo
                  </label>
                  <input
                    type="url"
                    value={config.store_logo_url}
                    onChange={(e) => setConfig(prev => ({ ...prev, store_logo_url: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="https://exemplo.com/logo.png"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descrição da Loja
                </label>
                <textarea
                  rows={3}
                  value={config.store_description}
                  onChange={(e) => setConfig(prev => ({ ...prev, store_description: e.target.value }))}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Descrição da sua loja..."
                />
              </div>

              {/* Logo Preview */}
              {config.store_logo_url && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pré-visualização do Logo
                  </label>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-md p-4 bg-gray-50 dark:bg-gray-700">
                    <img
                      src={config.store_logo_url}
                      alt="Logo Preview"
                      className="h-16 w-auto mx-auto object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden text-center text-sm text-red-500 dark:text-red-400 mt-2">
                      Erro ao carregar imagem
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Social Media Links */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                Redes Sociais
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(config.social_links).map(([platform, url]) => (
                  <div key={platform}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <div className="flex items-center space-x-2">
                        {getSocialIcon(platform)}
                        <span className="capitalize">
                          {platform === 'whatsapp' ? 'WhatsApp' : 
                           platform === 'youtube' ? 'YouTube' : 
                           platform === 'linkedin' ? 'LinkedIn' :
                           platform === 'website' ? 'Website' :
                           platform.charAt(0).toUpperCase() + platform.slice(1)}
                        </span>
                      </div>
                    </label>
                    <input
                      type={platform === 'whatsapp' ? 'tel' : 'url'}
                      value={url}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        social_links: { ...prev.social_links, [platform]: e.target.value }
                      }))}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                      placeholder={getSocialPlaceholder(platform)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                Informações de Contato
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email de Contato
                  </label>
                  <input
                    type="email"
                    value={config.contact_info.email}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      contact_info: { ...prev.contact_info, email: e.target.value }
                    }))}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="contato@streammanager.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Telefone de Contato
                  </label>
                  <input
                    type="tel"
                    value={config.contact_info.phone}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      contact_info: { ...prev.contact_info, phone: e.target.value }
                    }))}
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="+5584996105167"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Endereço (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={config.contact_info.address}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    contact_info: { ...prev.contact_info, address: e.target.value }
                  }))}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Endereço da sua empresa (opcional)"
                />
              </div>
            </div>

            {/* Store Banners Configuration */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                Configuração dos Banners da Loja
              </h4>
              
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Banners do Carrossel (JSON)
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      const textareaElement = document.querySelector('#store-banners-config') as HTMLTextAreaElement;
                      if (textareaElement) {
                        try {
                          const banners = JSON.parse(textareaElement.value);
                          
                          // Save banners configuration
                          const { error } = await supabase
                            .from('system_config')
                            .upsert({
                              key: 'store_banners',
                              value: banners,
                              description: 'Configuração dos banners da loja',
                              updated_at: new Date().toISOString()
                            }, {
                              onConflict: 'key'
                            });

                          if (error) throw error;
                          
                          alert('✅ Configuração dos banners salva com sucesso!');
                        } catch (error) {
                          console.error('Error saving banners:', error);
                          alert('❌ Erro ao salvar: ' + (error instanceof Error ? error.message : 'JSON inválido'));
                        }
                      }
                    }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    💾 Salvar Banners
                  </button>
                </div>
                
                <textarea
                  id="store-banners-config"
                  rows={12}
                  defaultValue={JSON.stringify(config.store_banners || [], null, 2)}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-xs"
                  placeholder={JSON.stringify([
                    {
                      id: "1",
                      title: "Título do Banner",
                      description: "Descrição do banner",
                      image_url: "https://exemplo.com/imagem.jpg",
                      link_url: "https://exemplo.com",
                      button_text: "Clique Aqui",
                      active: true,
                      order: 1
                    }
                  ], null, 2)}
                />
                
                <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <h5 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                    💡 Estrutura dos Banners
                  </h5>
                  <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                    <div><strong>id:</strong> Identificador único (string)</div>
                    <div><strong>title:</strong> Título do banner (string)</div>
                    <div><strong>description:</strong> Descrição do banner (string)</div>
                    <div><strong>image_url:</strong> URL da imagem (string)</div>
                    <div><strong>link_url:</strong> URL de destino (string, opcional)</div>
                    <div><strong>button_text:</strong> Texto do botão (string, opcional)</div>
                    <div><strong>active:</strong> Ativo/inativo (boolean)</div>
                    <div><strong>order:</strong> Ordem de exibição (number)</div>
                  </div>
                </div>
              </div>
            </div>
            {/* Preview */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                Pré-visualização
              </h4>
              
              {/* Header Preview */}
              <div className="bg-gray-900 text-white p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {config.store_logo_url ? (
                      <img
                        src={config.store_logo_url}
                        alt="Logo"
                        className="h-8 w-8 rounded object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg ${config.store_logo_url ? 'hidden' : ''}`}>
                      <Store className="h-4 w-4 text-white" />
                    </div>
                    <h5 className="font-bold text-lg">{config.store_name}</h5>
                  </div>
                  <div className="text-xs text-blue-200">
                    {config.store_description}
                  </div>
                </div>
              </div>

              {/* Footer Preview */}
              <div className="bg-gray-900 text-white p-6 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      {config.store_logo_url ? (
                        <img
                          src={config.store_logo_url}
                          alt="Logo"
                          className="h-6 w-6 rounded object-cover"
                        />
                      ) : (
                        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-1 rounded">
                          <Store className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <h5 className="font-bold">{config.store_name}</h5>
                    </div>
                    <p className="text-blue-200 text-xs">{config.store_description}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <h5 className="font-semibold">Redes Sociais</h5>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(config.social_links).map(([platform, url]) => {
                        if (!url) return null;
                        return (
                          <div key={platform} className="flex items-center space-x-1 text-xs text-blue-200">
                            {getSocialIcon(platform)}
                            <span className="capitalize">{platform}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h5 className="font-semibold">Contato</h5>
                    <div className="space-y-1 text-xs text-blue-200">
                      {config.contact_info.email && (
                        <div>{config.contact_info.email}</div>
                      )}
                      {config.contact_info.phone && (
                        <div>{config.contact_info.phone}</div>
                      )}
                      {config.contact_info.address && (
                        <div>{config.contact_info.address}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-white/10 mt-4 pt-4 text-center">
                  <p className="text-xs text-blue-200">{config.copyright}</p>
                </div>
              </div>
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