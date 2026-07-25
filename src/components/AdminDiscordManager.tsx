import React, { useState, useEffect } from 'react';
import { MessageCircle, Save, Loader, Check, X, AlertCircle, Bot, Hash, ToggleLeft, ToggleRight, Plus, Trash2, Send, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from './LanguageProvider';

interface DiscordConfig {
  id: number;
  bot_token: string | null;
  client_id: string | null;
  client_secret: string | null;
  guild_id: string | null;
  enabled: boolean;
  bot_username: string | null;
}

interface MessageTemplate {
  id: string;
  event_type: string;
  event_label: string;
  title: string;
  description: string;
  color: number;
  enabled: boolean;
}

interface DiscordLink {
  id: string;
  user_id: string;
  discord_user_id: string;
  discord_username: string;
  discord_avatar_url: string | null;
  verified: boolean;
  linked_at: string;
  notify_sales: boolean;
  notify_disputes: boolean;
  notify_cancellations: boolean;
  notify_withdrawals: boolean;
  notify_support: boolean;
  notify_system: boolean;
}

export function AdminDiscordManager() {
  const { language } = useLanguage();
  const [config, setConfig] = useState<DiscordConfig | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [links, setLinks] = useState<DiscordLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState<"config" | "templates" | "users">("config");
  const [testUserId, setTestUserId] = useState("");
  const [testSending, setTestSending] = useState(false);

  const tr = {
    title: language === 'pt' ? 'Gerenciar Discord' : language === 'en' ? 'Manage Discord' : 'Gestionar Discord',
    desc: language === 'pt' ? 'Configure o bot do Discord e mensagens de notificação' : language === 'en' ? 'Configure Discord bot and notification messages' : 'Configura el bot de Discord y mensajes de notificación',
    tabConfig: language === 'pt' ? 'Configuração do Bot' : language === 'en' ? 'Bot Configuration' : 'Configuración del Bot',
    tabTemplates: language === 'pt' ? 'Modelos de Mensagens' : language === 'en' ? 'Message Templates' : 'Plantillas de Mensajes',
    tabUsers: language === 'pt' ? 'Usuários Vinculados' : language === 'en' ? 'Linked Users' : 'Usuarios Vinculados',
    botToken: language === 'pt' ? 'Token do Bot' : language === 'en' ? 'Bot Token' : 'Token del Bot',
    botTokenDesc: language === 'pt' ? 'Token do bot obtido no Discord Developer Portal' : language === 'en' ? 'Bot token from Discord Developer Portal' : 'Token del bot obtenido en el Discord Developer Portal',
    clientId: language === 'pt' ? 'Client ID' : language === 'en' ? 'Client ID' : 'Client ID',
    clientSecret: language === 'pt' ? 'Client Secret' : language === 'en' ? 'Client Secret' : 'Client Secret',
    guildId: language === 'pt' ? 'ID do Servidor (Guild)' : language === 'en' ? 'Server ID (Guild)' : 'ID del Servidor (Guild)',
    guildIdDesc: language === 'pt' ? 'ID do servidor onde o bot está' : language === 'en' ? 'ID of the server where the bot is' : 'ID del servidor donde está el bot',
    enabled: language === 'pt' ? 'Sistema Ativo' : language === 'en' ? 'System Enabled' : 'Sistema Activo',
    testConnection: language === 'pt' ? 'Testar Conexão' : language === 'en' ? 'Test Connection' : 'Probar Conexión',
    save: language === 'pt' ? 'Salvar' : language === 'en' ? 'Save' : 'Guardar',
    saved: language === 'pt' ? 'Configuração salva!' : language === 'en' ? 'Configuration saved!' : '¡Configuración guardada!',
    testSuccess: language === 'pt' ? 'Bot conectado com sucesso! Bot: {username}' : language === 'en' ? 'Bot connected successfully! Bot: {username}' : '¡Bot conectado con éxito! Bot: {username}',
    testFail: language === 'pt' ? 'Falha ao conectar com o bot' : language === 'en' ? 'Failed to connect to bot' : 'Error al conectar con el bot',
    noLinks: language === 'pt' ? 'Nenhum usuário vinculado ainda' : language === 'en' ? 'No users linked yet' : 'Ningún usuario vinculado todavía',
    eventLabel: language === 'pt' ? 'Evento' : language === 'en' ? 'Event' : 'Evento',
    titleLabel: language === 'pt' ? 'Título' : language === 'en' ? 'Title' : 'Título',
    descriptionLabel: language === 'pt' ? 'Descrição' : language === 'en' ? 'Description' : 'Descripción',
    colorLabel: language === 'pt' ? 'Cor (hex)' : language === 'en' ? 'Color (hex)' : 'Color (hex)',
    enabledLabel: language === 'pt' ? 'Ativo' : language === 'en' ? 'Enabled' : 'Activo',
    addTemplate: language === 'pt' ? 'Adicionar Modelo' : language === 'en' ? 'Add Template' : 'Añadir Plantilla',
    saveTemplates: language === 'pt' ? 'Salvar Modelos' : language === 'en' ? 'Save Templates' : 'Guardar Plantillas',
    templatesSaved: language === 'pt' ? 'Modelos salvos!' : language === 'en' ? 'Templates saved!' : '¡Plantillas guardadas!',
    placeholders: language === 'pt' ? 'Variáveis: {product_name}, {amount}, {customer_name}, {order_id}, {reason}, {rating}, {comment}, {days}, {message}, {ticket_id}, {subject}, {decision}' : language === 'en' ? 'Variables: {product_name}, {amount}, {customer_name}, {order_id}, {reason}, {rating}, {comment}, {days}, {message}, {ticket_id}, {subject}, {decision}' : 'Variables: {product_name}, {amount}, {customer_name}, {order_id}, {reason}, {rating}, {comment}, {days}, {message}, {ticket_id}, {subject}, {decision}',
    sendTest: language === 'pt' ? 'Enviar Teste' : language === 'en' ? 'Send Test' : 'Enviar Prueba',
    testSent: language === 'pt' ? 'Notificação de teste enviada!' : language === 'en' ? 'Test notification sent!' : '¡Notificación de prueba enviada!',
    testUserId: language === 'pt' ? 'ID do usuário para teste' : language === 'en' ? 'User ID for test' : 'ID de usuario para prueba',
    linkedUsers: language === 'pt' ? 'Usuários com Discord vinculado' : language === 'en' ? 'Users with Discord linked' : 'Usuarios con Discord vinculado',
    verified: language === 'pt' ? 'Verificado' : language === 'en' ? 'Verified' : 'Verificado',
    pending: language === 'pt' ? 'Pendente' : language === 'en' ? 'Pending' : 'Pendiente',
  };

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: configData, error: configError } = await supabase.from("discord_config").select("*").eq("id", 1).maybeSingle();
      if (configError && configError.code !== "PGRST116") throw configError;
      setConfig(configData as DiscordConfig || { id: 1, bot_token: "", client_id: "", client_secret: "", guild_id: "", enabled: false, bot_username: "" });

      const { data: templatesData } = await supabase.from("discord_message_templates").select("*").order("event_label");
      setTemplates(templatesData as MessageTemplate[] || []);

      const { data: linksData } = await supabase.from("discord_user_links").select("*").order("linked_at", { ascending: false });
      setLinks(linksData as DiscordLink[] || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig() {
    if (!config) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const payload = {
        id: 1,
        bot_token: config.bot_token || null,
        client_id: config.client_id || null,
        client_secret: config.client_secret || null,
        guild_id: config.guild_id || null,
        enabled: config.enabled,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("discord_config").upsert(payload, { onConflict: "id" }).select("*").single();
      if (error) throw error;
      setSuccess(tr.saved);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving config");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    if (!config?.bot_token) { setError(tr.testFail); return; }
    setTesting(true); setError(""); setSuccess("");
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-bot`;
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: "test_bot", bot_token: config.bot_token }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || tr.testFail);
      setSuccess(tr.testSuccess.replace("{username}", json.bot_username || "unknown"));
      if (json.bot_username) setConfig({ ...config, bot_username: json.bot_username });
    } catch (err) {
      setError(err instanceof Error ? err.message : tr.testFail);
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveTemplates() {
    setSaving(true); setError(""); setSuccess("");
    try {
      for (const t of templates) {
        const { error } = await supabase.from("discord_message_templates").update({
          title: t.title,
          description: t.description,
          color: t.color,
          enabled: t.enabled,
          event_label: t.event_label,
          updated_at: new Date().toISOString(),
        }).eq("id", t.id);
        if (error) throw error;
      }
      setSuccess(tr.templatesSaved);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving templates");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTestNotification() {
    if (!testUserId.trim()) return;
    setTestSending(true); setError(""); setSuccess("");
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-bot`;
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: "send_notification",
          user_id: testUserId.trim(),
          event_type: "system_notification",
          variables: { message: "Esta é uma notificação de teste do sistema Discord." },
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed to send");
      setSuccess(tr.testSent);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error sending test");
    } finally {
      setTestSending(false);
    }
  }

  function updateTemplate(id: string, field: keyof MessageTemplate, value: any) {
    setTemplates(templates.map(t => t.id === id ? { ...t, [field]: value } : t));
  }

  function hexToInt(hex: string): number {
    const clean = hex.replace("#", "");
    return parseInt(clean, 16) || 0;
  }
  function intToHex(n: number): string {
    return "#" + n.toString(16).padStart(6, "0");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <MessageCircle className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tr.title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{tr.desc}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
        {[
          { key: "config" as const, label: tr.tabConfig, icon: Bot },
          { key: "templates" as const, label: tr.tabTemplates, icon: MessageCircle },
          { key: "users" as const, label: tr.tabUsers, icon: Users },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 flex items-start gap-2">
          <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <span className="text-sm text-emerald-700 dark:text-emerald-400">{success}</span>
        </div>
      )}

      {/* Config Tab */}
      {activeTab === "config" && config && (
        <div className="space-y-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{tr.botToken}</label>
            <p className="text-xs text-gray-400 mb-2">{tr.botTokenDesc}</p>
            <input type="password" value={config.bot_token || ""} onChange={e => setConfig({ ...config, bot_token: e.target.value })}
              placeholder="MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.Gabc12..." className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-400 font-mono" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{tr.clientId}</label>
              <input type="text" value={config.client_id || ""} onChange={e => setConfig({ ...config, client_id: e.target.value })}
                placeholder="123456789012345678" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-400 font-mono" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{tr.clientSecret}</label>
              <input type="password" value={config.client_secret || ""} onChange={e => setConfig({ ...config, client_secret: e.target.value })}
                placeholder="••••••••••••••••••••••••••••••" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-400 font-mono" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{tr.guildId}</label>
            <p className="text-xs text-gray-400 mb-2">{tr.guildIdDesc}</p>
            <input type="text" value={config.guild_id || ""} onChange={e => setConfig({ ...config, guild_id: e.target.value })}
              placeholder="987654321098765432" className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-400 font-mono" />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="flex items-center gap-3">
              {config.enabled ? <ToggleRight className="h-8 w-8 text-emerald-500" /> : <ToggleLeft className="h-8 w-8 text-gray-400" />}
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{tr.enabled}</p>
                <p className="text-xs text-gray-500">{config.enabled ? "ON" : "OFF"}</p>
              </div>
            </div>
            <button onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${config.enabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${config.enabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          {config.bot_username && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Bot className="h-4 w-4 text-indigo-500" />
              <span>Bot: <strong>{config.bot_username}</strong></span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={handleTestConnection} disabled={testing || !config.bot_token}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors disabled:opacity-50">
              {testing ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{tr.testConnection}
            </button>
            <button onClick={handleSaveConfig} disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{tr.save}
            </button>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3">
            <p className="text-xs text-indigo-700 dark:text-indigo-400">{tr.placeholders}</p>
          </div>
          {templates.map(t => (
            <div key={t.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{t.event_label}</span>
                  <code className="text-xs text-gray-400 font-mono">({t.event_type})</code>
                </div>
                <button onClick={() => updateTemplate(t.id, "enabled", !t.enabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${t.enabled ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${t.enabled ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{tr.titleLabel}</label>
                  <input type="text" value={t.title} onChange={e => updateTemplate(t.id, "title", e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-2.5 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{tr.colorLabel}</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={intToHex(t.color)} onChange={e => updateTemplate(t.id, "color", hexToInt(e.target.value))}
                      className="h-9 w-12 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer" />
                    <input type="text" value={intToHex(t.color)} onChange={e => updateTemplate(t.id, "color", hexToInt(e.target.value))}
                      className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-2.5 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-400 font-mono" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">{tr.descriptionLabel}</label>
                <textarea value={t.description} onChange={e => updateTemplate(t.id, "description", e.target.value)} rows={3}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-2.5 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-400 resize-y" />
              </div>
            </div>
          ))}
          <button onClick={handleSaveTemplates} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50">
            {saving ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{tr.saveTemplates}
          </button>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{tr.sendTest}</h3>
            <div className="flex gap-2">
              <input type="text" value={testUserId} onChange={e => setTestUserId(e.target.value)} placeholder={tr.testUserId}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-400 font-mono" />
              <button onClick={handleSendTestNotification} disabled={!testUserId.trim() || testSending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {testSending ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{tr.sendTest}
              </button>
            </div>
          </div>

          {links.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">{tr.noLinks}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {links.map(l => (
                <div key={l.id} className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  {l.discord_avatar_url ? (
                    <img src={l.discord_avatar_url} alt="" className="w-9 h-9 rounded-full" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center">
                      <MessageCircle className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{l.discord_username || "Unknown"}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">{l.discord_user_id}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${l.verified ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}>
                    {l.verified ? tr.verified : tr.pending}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}