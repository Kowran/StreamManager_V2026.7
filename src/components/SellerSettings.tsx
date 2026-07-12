import React, { useState, useEffect, useCallback } from 'react';
import {
  Store, Save, Settings as SettingsIcon, Globe, Mail, Clock,
  AlertTriangle, Check, Truck, Package, Calendar, Image as ImageIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface StoreSettings {
  id?: string;
  store_name: string;
  store_description: string;
  store_logo_url: string;
  store_banner_url: string;
  vacation_mode: boolean;
  auto_accept_orders: boolean;
  auto_delivery: boolean;
  min_order_amount: number;
  max_order_quantity: number;
  refund_policy: string;
  terms_of_service: string;
  estimated_delivery_time: string;
  contact_email: string;
  social_links: { instagram?: string; twitter?: string; telegram?: string; youtube?: string };
}

const defaultSettings: StoreSettings = {
  store_name: '',
  store_description: '',
  store_logo_url: '',
  store_banner_url: '',
  vacation_mode: false,
  auto_accept_orders: false,
  auto_delivery: true,
  min_order_amount: 0,
  max_order_quantity: 10,
  refund_policy: '',
  terms_of_service: '',
  estimated_delivery_time: 'Instant',
  contact_email: '',
  social_links: {},
};

export function SellerSettings() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const lbl = useCallback((pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es, [language]);

  useEffect(() => {
    loadSettings();
  }, [user]);

  async function loadSettings() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('seller_store_settings')
        .select('*')
        .eq('seller_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setSettings({
          ...defaultSettings,
          ...data,
          social_links: data.social_links || {},
        });
      } else {
        // Initialize with defaults
        const { data: newSettings, error: insertError } = await supabase
          .from('seller_store_settings')
          .insert({ seller_id: user.id, ...defaultSettings })
          .select('*')
          .maybeSingle();

        if (insertError) throw insertError;
        if (newSettings) {
          setSettings({ ...defaultSettings, ...newSettings, social_links: newSettings.social_links || {} });
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      const { error } = await supabase
        .from('seller_store_settings')
        .upsert({
          seller_id: user.id,
          store_name: settings.store_name,
          store_description: settings.store_description,
          store_logo_url: settings.store_logo_url,
          store_banner_url: settings.store_banner_url,
          vacation_mode: settings.vacation_mode,
          auto_accept_orders: settings.auto_accept_orders,
          auto_delivery: settings.auto_delivery,
          min_order_amount: settings.min_order_amount,
          max_order_quantity: settings.max_order_quantity,
          refund_policy: settings.refund_policy,
          terms_of_service: settings.terms_of_service,
          estimated_delivery_time: settings.estimated_delivery_time,
          contact_email: settings.contact_email,
          social_links: settings.social_links,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert(lbl('Erro ao salvar configurações', 'Error saving settings', 'Error al guardar configuración'));
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof StoreSettings>(field: K, value: StoreSettings[K]) {
    setSettings(prev => ({ ...prev, [field]: value }));
  }

  function updateSocialLink(platform: string, value: string) {
    setSettings(prev => ({
      ...prev,
      social_links: { ...prev.social_links, [platform]: value },
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Store Profile */}
      <SettingsSection
        icon={Store}
        title={lbl('Perfil da Loja', 'Store Profile', 'Perfil de Tienda')}
        description={lbl('Informações exibidas publicamente na sua loja', 'Information shown publicly on your store', 'Información mostrada públicamente en tu tienda')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={lbl('Nome da Loja', 'Store Name', 'Nombre de Tienda')}>
            <input type="text" value={settings.store_name}
              onChange={(e) => updateField('store_name', e.target.value)}
              className={inputClass}
              placeholder={lbl('Minha Loja', 'My Store', 'Mi Tienda')} />
          </Field>
          <Field label={lbl('Email de Contato', 'Contact Email', 'Email de Contacto')}>
            <input type="email" value={settings.contact_email}
              onChange={(e) => updateField('contact_email', e.target.value)}
              className={inputClass}
              placeholder="contact@store.com" />
          </Field>
        </div>
        <Field label={lbl('Descrição', 'Description', 'Descripción')}>
          <textarea rows={3} value={settings.store_description}
            onChange={(e) => updateField('store_description', e.target.value)}
            className={inputClass}
            placeholder={lbl('Descreva sua loja...', 'Describe your store...', 'Describe tu tienda...')} />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={lbl('URL do Logo', 'Logo URL', 'URL del Logo')}>
            <input type="url" value={settings.store_logo_url}
              onChange={(e) => updateField('store_logo_url', e.target.value)}
              className={inputClass}
              placeholder="https://..." />
          </Field>
          <Field label={lbl('URL do Banner', 'Banner URL', 'URL del Banner')}>
            <input type="url" value={settings.store_banner_url}
              onChange={(e) => updateField('store_banner_url', e.target.value)}
              className={inputClass}
              placeholder="https://..." />
          </Field>
        </div>
      </SettingsSection>

      {/* Store Restrictions */}
      <SettingsSection
        icon={AlertTriangle}
        title={lbl('Restrições da Loja', 'Store Restrictions', 'Restricciones de Tienda')}
        description={lbl('Configure limites e regras para pedidos', 'Configure limits and rules for orders', 'Configura límites y reglas para pedidos')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={lbl('Valor Mínimo por Pedido (USD)', 'Minimum Order Amount (USD)', 'Monto Mínimo (USD)')}>
            <input type="number" step="0.01" min="0" value={settings.min_order_amount}
              onChange={(e) => updateField('min_order_amount', parseFloat(e.target.value) || 0)}
              className={inputClass} />
          </Field>
          <Field label={lbl('Quantidade Máxima por Pedido', 'Max Quantity per Order', 'Cantidad Máxima por Pedido')}>
            <input type="number" min="1" value={settings.max_order_quantity}
              onChange={(e) => updateField('max_order_quantity', parseInt(e.target.value) || 1)}
              className={inputClass} />
          </Field>
        </div>
        <Field label={lbl('Tempo Estimado de Entrega', 'Estimated Delivery Time', 'Tiempo Estimado de Entrega')}>
          <input type="text" value={settings.estimated_delivery_time}
            onChange={(e) => updateField('estimated_delivery_time', e.target.value)}
            className={inputClass}
            placeholder={lbl('Ex: Instantâneo, 24h, 1-3 dias', 'E.g. Instant, 24h, 1-3 days', 'Ej: Instantáneo, 24h, 1-3 días')} />
        </Field>
      </SettingsSection>

      {/* Automation Settings */}
      <SettingsSection
        icon={SettingsIcon}
        title={lbl('Automação', 'Automation', 'Automatización')}
        description={lbl('Configure comportamentos automáticos da loja', 'Configure automatic store behaviors', 'Configura comportamientos automáticos')}
      >
        <ToggleRow
          label={lbl('Modo Férias', 'Vacation Mode', 'Modo Vacaciones')}
          description={lbl('Pausa temporariamente as vendas da sua loja', 'Temporarily pauses your store sales', 'Pausa temporalmente las ventas')}
          value={settings.vacation_mode}
          onChange={(v) => updateField('vacation_mode', v)}
        />
        <ToggleRow
          label={lbl('Aceitar Pedidos Automaticamente', 'Auto-Accept Orders', 'Auto-Aceptar Pedidos')}
          description={lbl('Confirma pedidos pagos sem intervenção manual', 'Confirms paid orders without manual intervention', 'Confirma pedidos pagados sin intervención')}
          value={settings.auto_accept_orders}
          onChange={(v) => updateField('auto_accept_orders', v)}
        />
        <ToggleRow
          label={lbl('Entrega Automática', 'Auto Delivery', 'Entrega Automática')}
          description={lbl('Entrega contas digitais automaticamente após pagamento', 'Delivers digital accounts automatically after payment', 'Entrega cuentas digitales automáticamente')}
          value={settings.auto_delivery}
          onChange={(v) => updateField('auto_delivery', v)}
        />
      </SettingsSection>

      {/* Policies */}
      <SettingsSection
        icon={Package}
        title={lbl('Políticas', 'Policies', 'Políticas')}
        description={lbl('Termos e políticas exibidos aos clientes', 'Terms and policies shown to customers', 'Términos y políticas mostrados a clientes')}
      >
        <Field label={lbl('Política de Reembolso', 'Refund Policy', 'Política de Reembolso')}>
          <textarea rows={3} value={settings.refund_policy}
            onChange={(e) => updateField('refund_policy', e.target.value)}
            className={inputClass}
            placeholder={lbl('Descreva sua política de reembolso...', 'Describe your refund policy...', 'Describe tu política de reembolso...')} />
        </Field>
        <Field label={lbl('Termos de Serviço', 'Terms of Service', 'Términos de Servicio')}>
          <textarea rows={3} value={settings.terms_of_service}
            onChange={(e) => updateField('terms_of_service', e.target.value)}
            className={inputClass}
            placeholder={lbl('Descreva seus termos de serviço...', 'Describe your terms of service...', 'Describe tus términos de servicio...')} />
        </Field>
      </SettingsSection>

      {/* Social Links */}
      <SettingsSection
        icon={Globe}
        title={lbl('Redes Sociais', 'Social Links', 'Redes Sociales')}
        description={lbl('Links exibidos no perfil da sua loja', 'Links shown on your store profile', 'Links mostrados en tu perfil')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Instagram">
            <input type="url" value={settings.social_links.instagram || ''}
              onChange={(e) => updateSocialLink('instagram', e.target.value)}
              className={inputClass} placeholder="https://instagram.com/..." />
          </Field>
          <Field label="Twitter / X">
            <input type="url" value={settings.social_links.twitter || ''}
              onChange={(e) => updateSocialLink('twitter', e.target.value)}
              className={inputClass} placeholder="https://x.com/..." />
          </Field>
          <Field label="Telegram">
            <input type="url" value={settings.social_links.telegram || ''}
              onChange={(e) => updateSocialLink('telegram', e.target.value)}
              className={inputClass} placeholder="https://t.me/..." />
          </Field>
          <Field label="YouTube">
            <input type="url" value={settings.social_links.youtube || ''}
              onChange={(e) => updateSocialLink('youtube', e.target.value)}
              className={inputClass} placeholder="https://youtube.com/..." />
          </Field>
        </div>
      </SettingsSection>

      {/* Save Button */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              {lbl('Salvo com sucesso!', 'Saved successfully!', '¡Guardado con éxito!')}
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? lbl('Salvando...', 'Saving...', 'Guardando...') : lbl('Salvar Configurações', 'Save Settings', 'Guardar Configuración')}
        </button>
      </div>
    </div>
  );
}

const inputClass = "w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
    </div>
  );
}

function SettingsSection({ icon: Icon, title, description, children }: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
            <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
          </div>
        </div>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );
}

function ToggleRow({ label, description, value, onChange }: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${value ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
