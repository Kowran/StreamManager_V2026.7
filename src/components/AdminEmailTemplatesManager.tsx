import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Save, Eye, Code, AlertCircle, CheckCircle, Loader2, RefreshCw, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface EmailTemplate {
  id: string;
  template_type: string;
  language: string;
  subject: string;
  html_content: string;
  description: string;
  available_variables: string[];
  enabled: boolean;
  updated_at: string;
}

const TEMPLATE_TYPE_LABELS: Record<string, { pt: string; en: string; es: string; icon: string }> = {
  sale_notification: { pt: 'Notificação de Venda', en: 'Sale Notification', es: 'Notificación de Venta', icon: 'shopping-cart' },
  recharge_deposit: { pt: 'Depósito de Recarga', en: 'Recharge Deposit', es: 'Depósito de Recarga', icon: 'credit-card' },
  purchase_confirmed: { pt: 'Compra Confirmada', en: 'Purchase Confirmed', es: 'Compra Confirmada', icon: 'check-circle' },
  dispute_opened: { pt: 'Disputa Aberta', en: 'Dispute Opened', es: 'Disputa Abierta', icon: 'alert-triangle' },
  seller_approved: { pt: 'Vendedor Aprovado', en: 'Seller Approved', es: 'Vendedor Aprobado', icon: 'award' },
  account_created: { pt: 'Conta Criada', en: 'Account Created', es: 'Cuenta Creada', icon: 'user-plus' },
  user_banned: { pt: 'Usuário Banido', en: 'User Banned', es: 'Usuario Baneado', icon: 'ban' },
};

const LANGUAGES = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export function AdminEmailTemplatesManager() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('sale_notification');
  const [selectedLang, setSelectedLang] = useState<string>('pt');
  const [editSubject, setEditSubject] = useState('');
  const [editHtml, setEditHtml] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [dirty, setDirty] = useState(false);

  const language = typeof window !== 'undefined'
    ? (localStorage.getItem('language') as 'pt' | 'en' | 'es') || 'pt'
    : 'pt';

  const t = {
    pt: {
      title: 'Modelos de Email',
      subtitle: 'Edite os modelos HTML de email enviados pelo sistema',
      save: 'Salvar',
      saved: 'Modelo salvo com sucesso!',
      saveError: 'Erro ao salvar modelo',
      subject: 'Assunto',
      htmlContent: 'Conteúdo HTML',
      preview: 'Pré-visualizar',
      code: 'Editar Código',
      templateType: 'Tipo de Email',
      language: 'Idioma',
      enabled: 'Ativado',
      disabled: 'Desativado',
      variables: 'Variáveis Disponíveis',
      variablesHint: 'Use estas variáveis no formato {{nome_da_variavel}} no HTML. Elas serão substituídas automaticamente.',
      description: 'Instruções',
      noTemplate: 'Nenhum modelo encontrado para este tipo e idioma',
      unsaved: 'Alterações não salvas',
      loading: 'Carregando modelos...',
    },
    en: {
      title: 'Email Templates',
      subtitle: 'Edit HTML templates for emails sent by the system',
      save: 'Save',
      saved: 'Template saved successfully!',
      saveError: 'Error saving template',
      subject: 'Subject',
      htmlContent: 'HTML Content',
      preview: 'Preview',
      code: 'Edit Code',
      templateType: 'Email Type',
      language: 'Language',
      enabled: 'Enabled',
      disabled: 'Disabled',
      variables: 'Available Variables',
      variablesHint: 'Use these variables as {{variable_name}} in the HTML. They will be replaced automatically.',
      description: 'Instructions',
      noTemplate: 'No template found for this type and language',
      unsaved: 'Unsaved changes',
      loading: 'Loading templates...',
    },
    es: {
      title: 'Plantillas de Email',
      subtitle: 'Edita las plantillas HTML de los correos enviados por el sistema',
      save: 'Guardar',
      saved: '¡Plantilla guardada con éxito!',
      saveError: 'Error al guardar la plantilla',
      subject: 'Asunto',
      htmlContent: 'Contenido HTML',
      preview: 'Vista previa',
      code: 'Editar Código',
      templateType: 'Tipo de Email',
      language: 'Idioma',
      enabled: 'Activado',
      disabled: 'Desactivado',
      variables: 'Variables Disponibles',
      variablesHint: 'Usa estas variables como {{nombre_variable}} en el HTML. Se reemplazarán automáticamente.',
      description: 'Instrucciones',
      noTemplate: 'No se encontró plantilla para este tipo e idioma',
      unsaved: 'Cambios sin guardar',
      loading: 'Cargando plantillas...',
    },
  };

  const tr = t[language] || t.pt;

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('template_type')
        .order('language');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading email templates:', error);
      setMessage({ type: 'error', text: String(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const currentTemplate = templates.find(
    (t) => t.template_type === selectedType && t.language === selectedLang
  );

  useEffect(() => {
    if (currentTemplate) {
      setEditSubject(currentTemplate.subject);
      setEditHtml(currentTemplate.html_content);
      setEditEnabled(currentTemplate.enabled);
      setDirty(false);
    }
  }, [selectedType, selectedLang, currentTemplate?.id]);

  const handleSave = async () => {
    if (!currentTemplate) return;

    try {
      setSaving(true);
      setMessage(null);

      const { error } = await supabase
        .from('email_templates')
        .update({
          subject: editSubject,
          html_content: editHtml,
          enabled: editEnabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentTemplate.id);

      if (error) throw error;

      setMessage({ type: 'success', text: tr.saved });
      setDirty(false);
      await loadTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      setMessage({ type: 'error', text: error.message || tr.saveError });
    } finally {
      setSaving(false);
    }
  };

  const handleSubjectChange = (val: string) => {
    setEditSubject(val);
    setDirty(true);
  };

  const handleHtmlChange = (val: string) => {
    setEditHtml(val);
    setDirty(true);
  };

  const handleEnabledChange = (val: boolean) => {
    setEditEnabled(val);
    setDirty(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">{tr.loading}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
              <Mail className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{tr.title}</h1>
              <p className="text-blue-100 text-sm mt-1">{tr.subtitle}</p>
            </div>
          </div>
          <button
            onClick={loadTemplates}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

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
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* Template Type Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {tr.templateType}
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(TEMPLATE_TYPE_LABELS).map(([type, labels]) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`p-3 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                selectedType === type
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              {labels[language] || labels.pt}
            </button>
          ))}
        </div>
      </div>

      {/* Language Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {tr.language}
        </label>
        <div className="flex gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setSelectedLang(lang.code)}
              className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                selectedLang === lang.code
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              {lang.flag} {lang.label}
            </button>
          ))}
        </div>
      </div>

      {currentTemplate ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          {/* Description / Instructions */}
          {currentTemplate.description && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">{tr.description}</p>
                  <p className="text-sm text-blue-700 dark:text-blue-400">{currentTemplate.description}</p>
                </div>
              </div>
            </div>
          )}

          {/* Available Variables */}
          {currentTemplate.available_variables && currentTemplate.available_variables.length > 0 && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{tr.variables}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{tr.variablesHint}</p>
              <div className="flex flex-wrap gap-2">
                {currentTemplate.available_variables.map((v) => (
                  <code key={v} className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded text-xs font-mono text-gray-700 dark:text-gray-300">
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Enable/Disable Toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={editEnabled}
                onChange={(e) => handleEnabledChange(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className={`text-sm font-medium ${editEnabled ? 'text-green-700 dark:text-green-400' : 'text-gray-500'}`}>
                {editEnabled ? tr.enabled : tr.disabled}
              </span>
            </label>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {tr.subject}
            </label>
            <input
              type="text"
              value={editSubject}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* HTML Content / Preview Toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {tr.htmlContent}
              </label>
              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {previewMode ? (
                  <>
                    <Code className="w-4 h-4" />
                    {tr.code}
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    {tr.preview}
                  </>
                )}
              </button>
            </div>

            {previewMode ? (
              <div
                className="w-full min-h-[400px] border border-gray-300 dark:border-gray-600 rounded-lg overflow-y-auto bg-white"
                dangerouslySetInnerHTML={{ __html: editHtml }}
              />
            ) : (
              <textarea
                value={editHtml}
                onChange={(e) => handleHtmlChange(e.target.value)}
                rows={20}
                className="w-full px-4 py-3 bg-gray-900 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm text-gray-100 dark:text-gray-100"
                spellCheck={false}
              />
            )}
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {tr.save}...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {tr.save}
                </>
              )}
            </button>
            {dirty && (
              <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                {tr.unsaved}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">{tr.noTemplate}</p>
        </div>
      )}
    </div>
  );
}
