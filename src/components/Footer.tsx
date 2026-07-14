import React, { useState, useEffect } from 'react';
import { Instagram, Youtube, MessageCircle, Mail, Globe, Heart, Twitter, Send, Music2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface SiteSettings {
  site_name?: string;
  footer_logo_url?: string;
  footer_text?: string;
  copyright_text?: string;
  contact_email?: string;
  social_links?: {
    instagram?: string;
    youtube?: string;
    whatsapp?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
}

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
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data: siteData } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'site_settings')
        .maybeSingle();

      const { data: storeData } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'store_config')
        .maybeSingle();

      setSiteSettings(siteData?.value || null);
      setStoreConfig(storeData?.value || null);
    } catch (error) {
      console.error('Error loading footer settings:', error);
    }
  }

  const siteName = siteSettings?.site_name || storeConfig?.store_name || 'StreamManager';
  const footerLogo = siteSettings?.footer_logo_url || storeConfig?.store_logo_url;
  const contactEmail = siteSettings?.contact_email || 'support@streammanager.com.br';
  const currentYear = new Date().getFullYear();
  const copyrightText = siteSettings?.copyright_text ||
    storeConfig?.copyright ||
    `© ${currentYear} ${siteName}. ${t.language === 'pt' ? 'Todos os direitos reservados.' : t.language === 'en' ? 'All rights reserved.' : 'Todos los derechos reservados.'}`;

  const social = { ...siteSettings?.social_links, ...storeConfig?.social_links };

  const socialLinks = [
    { name: 'Instagram', url: social.instagram, icon: Instagram, color: 'hover:text-pink-500' },
    { name: 'YouTube', url: social.youtube, icon: Youtube, color: 'hover:text-red-500' },
    { name: 'Twitter', url: social.twitter, icon: Twitter, color: 'hover:text-blue-400' },
    { name: 'Telegram', url: social.telegram, icon: Send, color: 'hover:text-blue-500' },
    {
      name: 'WhatsApp',
      url: (() => {
        const phoneNumber = social.whatsapp || storeConfig?.contact_info?.phone || '5584996105167';
        const message = encodeURIComponent(
          t.language === 'pt'
            ? `Olá! Gostaria de saber mais sobre o ${siteName}.`
            : t.language === 'en'
            ? `Hello! I would like to know more about ${siteName}.`
            : `¡Hola! Me gustaría saber más sobre ${siteName}.`
        );
        return `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${message}`;
      })(),
      icon: MessageCircle,
      color: 'hover:text-green-500'
    },
    { name: 'Discord', url: social.discord, icon: Music2, color: 'hover:text-indigo-400' },
  ].filter(link => link.url);

  return (
    <footer className="bg-gray-900 text-white py-6 mt-auto border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
          {/* Left side - Brand and Copyright */}
          <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6">
            <div className="flex items-center space-x-2">
              {footerLogo ? (
                <img
                  src={footerLogo}
                  alt="Logo"
                  className="h-6 w-6 object-contain rounded"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={`bg-gradient-to-r from-blue-500 to-cyan-600 p-1.5 rounded ${footerLogo ? 'hidden' : ''}`}>
                <Globe className="h-3 w-3 text-white" />
              </div>
              <span className="font-semibold text-sm">{siteName}</span>
            </div>

            <div className="text-xs text-gray-400 text-center md:text-left">
              {copyrightText}
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
          {socialLinks.length > 0 && (
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
          )}
        </div>

        {/* Bottom line with tagline */}
        {(siteSettings?.footer_text || t.language) && (
          <div className="mt-4 pt-4 border-t border-gray-800 text-center">
            <p className="text-xs text-gray-500 flex items-center justify-center space-x-1">
              {siteSettings?.footer_text ? (
                <span>{siteSettings.footer_text}</span>
              ) : (
                <>
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
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </footer>
  );
}
