import React, { useState } from 'react';
import {
  X, Languages, Bell, BellOff, Volume2, VolumeX,
  CornerDownLeft, CornerDownLeft as EnterIcon,
  Eye, EyeOff, Check, Globe,
} from 'lucide-react';
import { useLanguage } from './LanguageProvider';

export interface ChatSettingsData {
  auto_translate: boolean;
  translate_to: string;
  show_original: boolean;
  enter_to_send: boolean;
  sound_enabled: boolean;
}

interface ChatSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ChatSettingsData;
  onSave: (settings: ChatSettingsData) => void;
  isSaving: boolean;
}

const LANGUAGES = [
  { code: 'pt', label: 'Português', flag: 'BR' },
  { code: 'en', label: 'English', flag: 'US' },
  { code: 'es', label: 'Español', flag: 'ES' },
  { code: 'fr', label: 'Français', flag: 'FR' },
  { code: 'de', label: 'Deutsch', flag: 'DE' },
  { code: 'it', label: 'Italiano', flag: 'IT' },
  { code: 'ja', label: '日本語', flag: 'JP' },
  { code: 'ko', label: '한국어', flag: 'KR' },
  { code: 'zh', label: '中文', flag: 'CN' },
  { code: 'ru', label: 'Русский', flag: 'RU' },
  { code: 'ar', label: 'العربية', flag: 'SA' },
  { code: 'nl', label: 'Nederlands', flag: 'NL' },
];

export function ChatSettingsModal({ isOpen, onClose, settings, onSave, isSaving }: ChatSettingsModalProps) {
  const { language } = useLanguage();
  const [localSettings, setLocalSettings] = useState<ChatSettingsData>(settings);

  const tr = (pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es;

  if (!isOpen) return null;

  function update<K extends keyof ChatSettingsData>(key: K, value: ChatSettingsData[K]) {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    onSave(localSettings);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Languages className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {tr('Configurações do Chat', 'Chat Settings', 'Configuración del Chat')}
              </h2>
              <p className="text-xs text-gray-400">
                {tr('Personalize sua experiência', 'Customize your experience', 'Personaliza tu experiencia')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Translation Section */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              {tr('Tradução', 'Translation', 'Traducción')}
            </h3>

            {/* Auto-translate toggle */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {tr('Tradução Automática', 'Auto-Translate', 'Traducción Automática')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                    {tr('Traduz mensagens recebidas automaticamente para seu idioma', 'Automatically translate incoming messages to your language', 'Traduce automáticamente los mensajes entrantes a tu idioma')}
                  </p>
                </div>
                <ToggleSwitch
                  checked={localSettings.auto_translate}
                  onChange={v => update('auto_translate', v)}
                />
              </div>
            </div>

            {/* Language selector */}
            {localSettings.auto_translate && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 mb-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  {tr('Idioma de Tradução', 'Translation Language', 'Idioma de Traducción')}
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => update('translate_to', lang.code)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all ${
                        localSettings.translate_to === lang.code
                          ? 'bg-blue-500 text-white font-medium shadow-sm'
                          : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500'
                      }`}
                    >
                      <span className="text-xs font-mono opacity-70">{lang.flag}</span>
                      <span className="truncate flex-1 text-left">{lang.label}</span>
                      {localSettings.translate_to === lang.code && (
                        <Check className="h-3.5 w-3.5 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Show original toggle */}
            {localSettings.auto_translate && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                      {localSettings.show_original ? <Eye className="h-4 w-4 text-gray-400" /> : <EyeOff className="h-4 w-4 text-gray-400" />}
                      {tr('Mostrar Texto Original', 'Show Original Text', 'Mostrar Texto Original')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {tr('Exibe o texto original junto à tradução', 'Show original text alongside translation', 'Muestra el texto original junto a la traducción')}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={localSettings.show_original}
                    onChange={v => update('show_original', v)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Behavior Section */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <CornerDownLeft className="h-3.5 w-3.5" />
              {tr('Comportamento', 'Behavior', 'Comportamiento')}
            </h3>

            {/* Enter to send */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 mb-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {tr('Enter para Enviar', 'Enter to Send', 'Enter para Enviar')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {tr('Pressione Enter para enviar, Shift+Enter para nova linha', 'Press Enter to send, Shift+Enter for new line', 'Presiona Enter para enviar, Shift+Enter para nueva línea')}
                  </p>
                </div>
                <ToggleSwitch
                  checked={localSettings.enter_to_send}
                  onChange={v => update('enter_to_send', v)}
                />
              </div>
            </div>

            {/* Sound toggle */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                    {localSettings.sound_enabled ? <Volume2 className="h-4 w-4 text-gray-400" /> : <VolumeX className="h-4 w-4 text-gray-400" />}
                    {tr('Som de Notificação', 'Notification Sound', 'Sonido de Notificación')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {tr('Reproduz som ao receber nova mensagem', 'Play sound when receiving a new message', 'Reproduce sonido al recibir un nuevo mensaje')}
                  </p>
                </div>
                <ToggleSwitch
                  checked={localSettings.sound_enabled}
                  onChange={v => update('sound_enabled', v)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {tr('Cancelar', 'Cancel', 'Cancelar')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {tr('Salvando...', 'Saving...', 'Guardando...')}
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {tr('Salvar', 'Save', 'Guardar')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-3 ${
        checked ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
