import React, { useState, useEffect } from 'react';
import { Globe, Save, Loader2, CheckCircle, AlertCircle, Image as ImageIcon, Type, Mail, Link2, Navigation as Favicon, FileText, Eye, Upload, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SiteSettings {
  site_name: string;
  browser_title: string;
  favicon_url: string;
  header_logo_url: string;
  footer_logo_url: string;
  footer_text: string;
  copyright_text: string;
  contact_email: string;
  meta_description: string;
  social_links: {
    instagram?: string;
    youtube?: string;
    whatsapp?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
}

const DEFAULT_SETTINGS: SiteSettings = {
  site_name: 'StreamManager',
  browser_title: 'StreamManager - World Leading Digital Marketplace Platform',
  favicon_url: '',
  header_logo_url: '',
  footer_logo_url: '',
  footer_text: 'The World Leading Digital Marketplace Platform',
  copyright_text: '',
  contact_email: 'support@streammanager.com.br',
  meta_description: 'Buy and sell digital products, streaming accounts, SMM services and more on the world\'s leading digital marketplace platform.',
  social_links: {
    instagram: '',
    youtube: '',
    whatsapp: '',
    twitter: '',
    telegram: '',
    discord: '',
  },
};

export default function AdminSiteSettingsManager() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [previewFavicon, setPreviewFavicon] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'site_settings')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      const loaded = { ...DEFAULT_SETTINGS, ...(data?.value || {}) };
      loaded.social_links = { ...DEFAULT_SETTINGS.social_links, ...(data?.value?.social_links || {}) };
      setSettings(loaded);
      setOriginalSettings(loaded);
    } catch (err) {
      console.error('Error loading site settings:', err);
      setMessage({ type: 'error', text: 'Failed to load site settings' });
    } finally {
      setLoading(false);
    }
  }

  function hasChanges(): boolean {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }

  async function handleSave() {
    try {
      setSaving(true);
      setMessage(null);

      const { data: existing } = await supabase
        .from('system_config')
        .select('id')
        .eq('key', 'site_settings')
        .maybeSingle();

      let error;
      if (existing) {
        const result = await supabase
          .from('system_config')
          .update({ value: settings, updated_at: new Date().toISOString() })
          .eq('key', 'site_settings');
        error = result.error;
      } else {
        const result = await supabase
          .from('system_config')
          .insert({ key: 'site_settings', value: settings, description: 'Site branding and appearance settings' });
        error = result.error;
      }

      if (error) throw error;

      setOriginalSettings(settings);
      setMessage({ type: 'success', text: 'Site settings saved successfully!' });
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      console.error('Error saving site settings:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(field: 'favicon_url' | 'header_logo_url' | 'footer_logo_url', file: File) {
    if (!file) return;

    try {
      setUploadingField(field);

      const fileExt = file.name.split('.').pop();
      const fileName = `site-${field}-${Date.now()}.${fileExt}`;
      const filePath = `site-assets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setSettings(prev => ({ ...prev, [field]: urlData.publicUrl }));
      setMessage({ type: 'success', text: 'Image uploaded successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error('Upload error:', err);
      setMessage({ type: 'error', text: `Upload failed: ${err.message}` });
    } finally {
      setUploadingField(null);
    }
  }

  function updateField(field: keyof SiteSettings, value: string) {
    setSettings(prev => ({ ...prev, [field]: value }));
  }

  function updateSocialLink(platform: keyof SiteSettings['social_links'], value: string) {
    setSettings(prev => ({
      ...prev,
      social_links: { ...prev.social_links, [platform]: value }
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading site settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-3 rounded-xl">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Site Settings</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              Configure your site branding, logos, favicon, and more
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges()}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all ${
            hasChanges() && !saving
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span className="font-medium text-sm">{message.text}</span>
        </div>
      )}

      {/* Site Identity */}
      <SectionCard icon={<Type className="w-5 h-5" />} title="Site Identity" description="Basic information about your site">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Site Name" hint="Displayed in header, footer, and user menu">
            <input
              type="text"
              value={settings.site_name}
              onChange={e => updateField('site_name', e.target.value)}
              placeholder="StreamManager"
              className={inputClass}
            />
          </FormField>
          <FormField label="Browser Title" hint="Shown in the browser tab / window title">
            <input
              type="text"
              value={settings.browser_title}
              onChange={e => updateField('browser_title', e.target.value)}
              placeholder="StreamManager - World Leading Digital Marketplace Platform"
              className={inputClass}
            />
          </FormField>
        </div>
        <FormField label="Meta Description" hint="SEO description for search engines">
          <textarea
            value={settings.meta_description}
            onChange={e => updateField('meta_description', e.target.value)}
            rows={2}
            placeholder="The world's leading digital marketplace platform..."
            className={inputClass}
          />
        </FormField>
      </SectionCard>

      {/* Logos & Favicon */}
      <SectionCard icon={<ImageIcon className="w-5 h-5" />} title="Logos & Favicon" description="Visual branding for your site">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Header Logo */}
          <ImageUploadField
            label="Header Logo"
            hint="Shown in the top navigation bar"
            value={settings.header_logo_url}
            uploading={uploadingField === 'header_logo_url'}
            onUpload={file => handleImageUpload('header_logo_url', file)}
            onClear={() => updateField('header_logo_url', '')}
            previewClass="h-10 w-10 object-contain rounded-lg"
          />
          {/* Footer Logo */}
          <ImageUploadField
            label="Footer Logo"
            hint="Shown in the footer area"
            value={settings.footer_logo_url}
            uploading={uploadingField === 'footer_logo_url'}
            onUpload={file => handleImageUpload('footer_logo_url', file)}
            onClear={() => updateField('footer_logo_url', '')}
            previewClass="h-8 w-8 object-contain rounded"
          />
          {/* Favicon */}
          <ImageUploadField
            label="Favicon"
            hint="Browser tab icon (32x32 or 192x192 recommended)"
            value={settings.favicon_url}
            uploading={uploadingField === 'favicon_url'}
            onUpload={file => handleImageUpload('favicon_url', file)}
            onClear={() => updateField('favicon_url', '')}
            previewClass="h-8 w-8 object-contain rounded"
            onPreviewToggle={() => setPreviewFavicon(!previewFavicon)}
          />
        </div>
        {previewFavicon && settings.favicon_url && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 mb-2 font-medium">Favicon Preview (browser tab simulation)</p>
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-md px-3 py-2 border border-gray-200 dark:border-gray-600 shadow-sm w-fit">
              <img src={settings.favicon_url} alt="Favicon" className="h-4 w-4 object-contain" />
              <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate max-w-[200px]">
                {settings.browser_title || settings.site_name}
              </span>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Footer & Contact */}
      <SectionCard icon={<FileText className="w-5 h-5" />} title="Footer & Contact" description="Customize the footer area and contact information">
        <div className="space-y-4">
          <FormField label="Footer Text" hint="Tagline shown in the footer">
            <input
              type="text"
              value={settings.footer_text}
              onChange={e => updateField('footer_text', e.target.value)}
              placeholder="The World Leading Digital Marketplace Platform"
              className={inputClass}
            />
          </FormField>
          <FormField label="Copyright Text" hint="Leave empty to auto-generate: (c) Year SiteName. All rights reserved.">
            <input
              type="text"
              value={settings.copyright_text}
              onChange={e => updateField('copyright_text', e.target.value)}
              placeholder="© 2026 YourSite. All rights reserved."
              className={inputClass}
            />
          </FormField>
          <FormField label="Contact Email" hint="Email shown in the footer">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={settings.contact_email}
                onChange={e => updateField('contact_email', e.target.value)}
                placeholder="support@example.com"
                className={`${inputClass} pl-10`}
              />
            </div>
          </FormField>
        </div>
      </SectionCard>

      {/* Social Links */}
      <SectionCard icon={<Link2 className="w-5 h-5" />} title="Social Links" description="Social media links shown in the footer">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Instagram URL">
            <input
              type="url"
              value={settings.social_links.instagram || ''}
              onChange={e => updateSocialLink('instagram', e.target.value)}
              placeholder="https://instagram.com/yourbrand"
              className={inputClass}
            />
          </FormField>
          <FormField label="YouTube URL">
            <input
              type="url"
              value={settings.social_links.youtube || ''}
              onChange={e => updateSocialLink('youtube', e.target.value)}
              placeholder="https://youtube.com/@yourchannel"
              className={inputClass}
            />
          </FormField>
          <FormField label="WhatsApp Number" hint="Include country code, e.g. 5584996105167">
            <input
              type="text"
              value={settings.social_links.whatsapp || ''}
              onChange={e => updateSocialLink('whatsapp', e.target.value)}
              placeholder="5584996105167"
              className={inputClass}
            />
          </FormField>
          <FormField label="Twitter / X URL">
            <input
              type="url"
              value={settings.social_links.twitter || ''}
              onChange={e => updateSocialLink('twitter', e.target.value)}
              placeholder="https://twitter.com/yourbrand"
              className={inputClass}
            />
          </FormField>
          <FormField label="Telegram URL">
            <input
              type="url"
              value={settings.social_links.telegram || ''}
              onChange={e => updateSocialLink('telegram', e.target.value)}
              placeholder="https://t.me/yourbrand"
              className={inputClass}
            />
          </FormField>
          <FormField label="Discord URL">
            <input
              type="url"
              value={settings.social_links.discord || ''}
              onChange={e => updateSocialLink('discord', e.target.value)}
              placeholder="https://discord.gg/yourserver"
              className={inputClass}
            />
          </FormField>
        </div>
      </SectionCard>

      {/* Live Preview */}
      <SectionCard icon={<Eye className="w-5 h-5" />} title="Live Preview" description="Preview how your settings will appear">
        <div className="space-y-4">
          {/* Header preview */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2 font-medium">Header Preview</p>
            <div className="flex items-center gap-2">
              {settings.header_logo_url ? (
                <img src={settings.header_logo_url} alt="Logo" className="h-8 w-8 object-contain rounded-lg" />
              ) : (
                <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-2 rounded-lg">
                  <Globe className="h-4 w-4 text-white" />
                </div>
              )}
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {settings.site_name || 'StreamManager'}
              </span>
            </div>
          </div>

          {/* Footer preview */}
          <div className="bg-gray-900 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-3 font-medium">Footer Preview</p>
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {settings.footer_logo_url ? (
                  <img src={settings.footer_logo_url} alt="Logo" className="h-6 w-6 object-contain rounded" />
                ) : (
                  <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-1.5 rounded">
                    <Globe className="h-3 w-3 text-white" />
                  </div>
                )}
                <span className="font-semibold text-sm text-white">{settings.site_name || 'StreamManager'}</span>
              </div>
              <div className="text-xs text-gray-400 text-center">
                {settings.copyright_text || `© ${new Date().getFullYear()} ${settings.site_name || 'StreamManager'}. All rights reserved.`}
              </div>
              <div className="flex items-center gap-3">
                {settings.social_links.instagram && <span className="text-xs text-gray-400">Instagram</span>}
                {settings.social_links.youtube && <span className="text-xs text-gray-400">YouTube</span>}
                {settings.social_links.whatsapp && <span className="text-xs text-gray-400">WhatsApp</span>}
                {settings.social_links.twitter && <span className="text-xs text-gray-400">Twitter</span>}
                {settings.social_links.telegram && <span className="text-xs text-gray-400">Telegram</span>}
                {settings.social_links.discord && <span className="text-xs text-gray-400">Discord</span>}
              </div>
            </div>
            {settings.footer_text && (
              <div className="mt-3 pt-3 border-t border-gray-800 text-center">
                <p className="text-xs text-gray-500">{settings.footer_text}</p>
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

const inputClass = "w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all";

function SectionCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/10">
        <div className="flex items-center gap-3">
          <div className="text-blue-600 dark:text-blue-400">{icon}</div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

function ImageUploadField({
  label, hint, value, uploading, onUpload, onClear, previewClass, onPreviewToggle
}: {
  label: string;
  hint: string;
  value: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
  previewClass: string;
  onPreviewToggle?: () => void;
}) {
  const inputId = `upload-${label.replace(/\s/g, '-').toLowerCase()}`;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{hint}</p>
      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0">
            {value ? (
              <img src={value} alt={label} className={previewClass} />
            ) : (
              <ImageIcon className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div className="flex-1 space-y-1.5">
            <label htmlFor={inputId} className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              {uploading ? 'Uploading...' : 'Upload'}
            </label>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = '';
              }}
            />
            {value && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onClear}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                >
                  <X className="w-3 h-3" />
                  Remove
                </button>
                {onPreviewToggle && (
                  <button
                    onClick={onPreviewToggle}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    Preview
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
