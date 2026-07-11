import React, { useState, useEffect } from 'react';
import { Instagram, Youtube, MessageCircle, Mail, Globe, Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface StoreConfig {
  store_name?: string;
  store_logo_url?: string;
  copyright?: string;
  social_links?: {
    whatsapp?: string;
  };
  contact_info?: {
    phone?: string;
  };
}

export function Footer() {
  const { t } = useLanguage();
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);

  useEffect(() => {
    loadStoreConfig();
  }, []);

  async function loadStoreConfig() {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'store_config')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setStoreConfig(data?.value || null);
    } catch (error) {
      console.error('Error loading store config:', error);
    }
  }

  const socialLinks = [
    {
      name: 'Instagram',
      url: 'https://www.instagram.com/streammanageroficial/',
      icon: Instagram,
      color: 'hover:text-pink-500'
    },
    {
      name: 'YouTube',
      url: 'https://www.youtube.com/@streamamanageroficial/featured',
      icon: Youtube,
      color: 'hover:text-red-500'
    },
    {
      name: 'WhatsApp',
      url: (() => {
        const phoneNumber = storeConfig?.social_links?.whatsapp || 
                           storeConfig?.contact_info?.phone || 
                           '5584996105167';
        const message = encodeURIComponent(
          t.language === 'pt' 
            ? 'Olá! Gostaria de saber mais sobre o StreamManager.'
            : t.language === 'en'
            ? 'Hello! I would like to know more about StreamManager.'
            : '¡Hola! Me gustaría saber más sobre StreamManager.'
        );
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        return `https://wa.me/${cleanPhone}?text=${message}`;
      })(),
      icon: MessageCircle,
      color: 'hover:text-green-500'
    }
  ];

  const contactEmail = 'support@streammanager.com.br';
  const storeName = storeConfig?.store_name || 'StreamManager';
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white py-6 mt-auto border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
          {/* Left side - Brand and Copyright */}
          <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6">
            <div className="flex items-center space-x-2">
              {storeConfig?.store_logo_url ? (
                <img
                  src={storeConfig.store_logo_url}
                  alt="Logo"
                  className="h-6 w-6 object-cover rounded"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={`bg-gradient-to-r from-blue-500 to-purple-600 p-1.5 rounded ${storeConfig?.store_logo_url ? 'hidden' : ''}`}>
                <Globe className="h-3 w-3 text-white" />
              </div>
              <span className="font-semibold text-sm">{storeName}</span>
            </div>
            
            <div className="text-xs text-gray-400 text-center md:text-left">
              {storeConfig?.copyright || `© ${currentYear} ${storeName}. Todos os direitos reservados.`}
            </div>
          </div>

          {/* Center - Contact Email */}
          <div className="flex items-center space-x-2 text-xs text-gray-400">
            <Mail className="h-3 w-3" />
            <a 
              href={`mailto:${contactEmail}`}
              className="hover:text-white transition-colors"
            >
              {contactEmail}
            </a>
          </div>

          {/* Right side - Social Links */}
          <div className="flex items-center space-x-4">
            <span className="text-xs text-gray-400 hidden sm:inline">
              {t.language === 'pt' ? 'Siga-nos:' :
               t.language === 'en' ? 'Follow us:' :
               'Síguenos:'}
            </span>
            <div className="flex items-center space-x-3">
              {socialLinks.map((social) => {
                const IconComponent = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-gray-400 ${social.color} transition-colors duration-200 transform hover:scale-110`}
                    title={social.name}
                  >
                    <IconComponent className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom line with love */}
        <div className="mt-4 pt-4 border-t border-gray-800 text-center">
          <p className="text-xs text-gray-500 flex items-center justify-center space-x-1">
            <span>
              {t.language === 'pt' ? 'Feito com' :
               t.language === 'en' ? 'Made with' :
               'Hecho con'}
            </span>
            <Heart className="h-3 w-3 text-red-500 animate-pulse" />
            <span>
              {t.language === 'pt' ? 'para a comunidade de streaming' :
               t.language === 'en' ? 'for the streaming community' :
               'para la comunidad de streaming'}
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}