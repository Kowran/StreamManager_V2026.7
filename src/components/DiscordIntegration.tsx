import React, { useState, useEffect } from 'react';
import { MessageCircle, Check, X, Loader, Send, Link2, Unlink, Bell, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';

interface DiscordLink {
  id: string;
  discord_user_id: string | null;
  discord_username: string | null;
  discord_avatar_url: string | null;
  verified: boolean;
  notify_sales: boolean;
  notify_disputes: boolean;
  notify_cancellations: boolean;
  notify_withdrawals: boolean;
  notify_support: boolean;
  notify_system: boolean;
}

export function DiscordIntegration() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [link, setLink] = useState<DiscordLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [discordId, setDiscordId] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);

  const tr = {
    title: language === 'pt' ? 'Discord' : language === 'en' ? 'Discord' : 'Discord',
    desc: language === 'pt' ? 'Vincule sua conta Discord para receber notificações por mensagem direta' : language === 'en' ? 'Link your Discord account to receive DM notifications' : 'Vincula tu cuenta de Discord para recibir notificaciones por mensaje directo',
    notLinked: language === 'pt' ? 'Não vinculado' : language === 'en' ? 'Not linked' : 'No vinculado',
    linked: language === 'pt' ? 'Vinculado' : language === 'en' ? 'Linked' : 'Vinculado',
    pending: language === 'pt' ? 'Verificação pendente' : language === 'en' ? 'Pending verification' : 'Verificación pendiente',
    idLabel: language === 'pt' ? 'Seu ID do Discord' : language === 'en' ? 'Your Discord User ID' : 'Tu ID de Discord',
    idPlaceholder: '123456789012345678',
    idHint: language === 'pt' ? 'Ative o Modo Desenvolvedor no Discord (Configurações > Avançado), clique com botão direito no seu perfil e copie o ID' : language === 'en' ? 'Enable Developer Mode in Discord (Settings > Advanced), right-click your profile and copy ID' : 'Activa el Modo Desarrollador en Discord (Configuración > Avanzado), clic derecho en tu perfil y copia el ID',
    sendCode: language === 'pt' ? 'Enviar código' : language === 'en' ? 'Send code' : 'Enviar código',
    codeLabel: language === 'pt' ? 'Código de verificação' : language === 'en' ? 'Verification code' : 'Código de verificación',
    codePlaceholder: '000000',
    verify: language === 'pt' ? 'Verificar' : language === 'en' ? 'Verify' : 'Verificar',
    verifySuccess: language === 'pt' ? 'Conta Discord vinculada com sucesso!' : language === 'en' ? 'Discord account linked successfully!' : '¡Cuenta de Discord vinculada con éxito!',
    codeSent: language === 'pt' ? 'Código enviado para seu Discord! Verifique suas mensagens diretas.' : language === 'en' ? 'Code sent to your Discord! Check your DMs.' : '¡Código enviado a tu Discord! Revisa tus mensajes directos.',
    unlink: language === 'pt' ? 'Desvincular' : language === 'en' ? 'Unlink' : 'Desvincular',
    unlinkConfirm: language === 'pt' ? 'Tem certeza que deseja desvincular sua conta Discord?' : language === 'en' ? 'Are you sure you want to unlink your Discord account?' : '¿Seguro que quieres desvincular tu cuenta de Discord?',
    prefsTitle: language === 'pt' ? 'Preferências de Notificação' : language === 'en' ? 'Notification Preferences' : 'Preferencias de Notificación',
    prefsSales: language === 'pt' ? 'Vendas' : language === 'en' ? 'Sales' : 'Ventas',
    prefsDisputes: language === 'pt' ? 'Disputas' : language === 'en' ? 'Disputes' : 'Disputas',
    prefsCancellations: language === 'pt' ? 'Cancelamentos' : language === 'en' ? 'Cancellations' : 'Cancelaciones',
    prefsWithdrawals: language === 'pt' ? 'Saques' : language === 'en' ? 'Withdrawals' : 'Retiros',
    prefsSupport: language === 'pt' ? 'Suporte' : language === 'en' ? 'Support' : 'Soporte',
    prefsSystem: language === 'pt' ? 'Sistema' : language === 'en' ? 'System' : 'Sistema',
    savePrefs: language === 'pt' ? 'Salvar preferências' : language === 'en' ? 'Save preferences' : 'Guardar preferencias',
    prefsSaved: language === 'pt' ? 'Preferências salvas!' : language === 'en' ? 'Preferences saved!' : '¡Preferencias guardadas!',
    notConfigured: language === 'pt' ? 'O sistema de Discord ainda não foi configurado pelo administrador.' : language === 'en' ? 'Discord system not yet configured by admin.' : 'El sistema de Discord aún no está configurado por el administrador.',
  };

  useEffect(() => {
    if (user) loadLink();
  }, [user]);

  async function loadLink() {
    if (!user) return;
    try {
      const { data, error } = await supabase.from("discord_user_links").select("*").eq("user_id", user.id).maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      setLink(data as DiscordLink | null);
    } catch (err) {
      console.error("Error loading discord link:", err);
    } finally {
      setLoading(false);
    }
  }

  async function callEdgeFunction(payload: any) {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-bot`;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Request failed");
    return json;
  }

  async function handleSendCode() {
    if (!user || !discordId.trim()) return;
    setError(""); setSuccess("");
    setSendingCode(true);
    try {
      await callEdgeFunction({
        action: "send_verification",
        user_id: user.id,
        discord_user_id: discordId.trim(),
      });
      setSuccess(tr.codeSent);
      await loadLink();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar código");
    } finally {
      setSendingCode(false);
    }
  }

  async function handleVerify() {
    if (!user || !code.trim()) return;
    setError(""); setSuccess("");
    setVerifying(true);
    try {
      await callEdgeFunction({
        action: "verify_code",
        user_id: user.id,
        code: code.trim(),
      });
      setSuccess(tr.verifySuccess);
      setCode("");
      await loadLink();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao verificar código");
    } finally {
      setVerifying(false);
    }
  }

  async function handleUnlink() {
    if (!user || !link) return;
    if (!confirm(tr.unlinkConfirm)) return;
    setUnsubscribing(true);
    setError("");
    try {
      const { error } = await supabase.from("discord_user_links").delete().eq("user_id", user.id);
      if (error) throw error;
      setLink(null);
      setDiscordId("");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao desvincular");
    } finally {
      setUnsubscribing(false);
    }
  }

  async function handleTogglePref(key: keyof DiscordLink) {
    if (!user || !link) return;
    const newValue = !link[key];
    setLink({ ...link, [key]: newValue });
  }

  async function handleSavePrefs() {
    if (!user || !link) return;
    setSavingPrefs(true);
    setError("");
    try {
      const { error } = await supabase.from("discord_user_links").update({
        notify_sales: link.notify_sales,
        notify_disputes: link.notify_disputes,
        notify_cancellations: link.notify_cancellations,
        notify_withdrawals: link.notify_withdrawals,
        notify_support: link.notify_support,
        notify_system: link.notify_system,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
      if (error) throw error;
      setSuccess(tr.prefsSaved);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar preferências");
    } finally {
      setSavingPrefs(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const prefs: { key: keyof DiscordLink; label: string }[] = [
    { key: "notify_sales", label: tr.prefsSales },
    { key: "notify_disputes", label: tr.prefsDisputes },
    { key: "notify_cancellations", label: tr.prefsCancellations },
    { key: "notify_withdrawals", label: tr.prefsWithdrawals },
    { key: "notify_support", label: tr.prefsSupport },
    { key: "notify_system", label: tr.prefsSystem },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
          <MessageCircle className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{tr.title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{tr.desc}</p>
        </div>
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

      {/* Status badge */}
      <div className="flex items-center gap-2">
        {link?.verified ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            <Check className="h-3.5 w-3.5" />{tr.linked}
          </span>
        ) : link && !link.verified ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <Loader className="h-3.5 w-3.5" />{tr.pending}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <X className="h-3.5 w-3.5" />{tr.notLinked}
          </span>
        )}
      </div>

      {/* Linked account info */}
      {link?.verified && (
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
          {link.discord_avatar_url ? (
            <img src={link.discord_avatar_url} alt="Discord avatar" className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{link.discord_username || "Discord User"}</p>
            <p className="text-xs text-gray-400 font-mono truncate">ID: {link.discord_user_id}</p>
          </div>
          <button
            onClick={handleUnlink}
            disabled={unsubscribing}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            <Unlink className="h-3.5 w-3.5" />{tr.unlink}
          </button>
        </div>
      )}

      {/* Link form */}
      {!link?.verified && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">{tr.idLabel}</label>
            <input
              type="text"
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value)}
              placeholder={tr.idPlaceholder}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-400 font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">{tr.idHint}</p>
          </div>

          <button
            onClick={handleSendCode}
            disabled={!discordId.trim() || sendingCode}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition-colors disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700"
          >
            {sendingCode ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {tr.sendCode}
          </button>

          {link && !link.verified && (
            <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">{tr.codeLabel}</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder={tr.codePlaceholder}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-400 font-mono text-center text-lg tracking-widest"
                />
              </div>
              <button
                onClick={handleVerify}
                disabled={code.length !== 6 || verifying}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition-colors disabled:opacity-50 bg-emerald-600 hover:bg-emerald-700"
              >
                {verifying ? <Loader className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {tr.verify}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Notification preferences */}
      {link?.verified && (
        <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5" />{tr.prefsTitle}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {prefs.map((pref) => {
              const enabled = link[pref.key] as boolean;
              return (
                <button
                  key={pref.key}
                  onClick={() => handleTogglePref(pref.key)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="text-sm text-gray-700 dark:text-gray-300">{pref.label}</span>
                  <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-1"}`} />
                  </span>
                </button>
              );
            })}
          </div>
          <button
            onClick={handleSavePrefs}
            disabled={savingPrefs}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition-colors disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700"
          >
            {savingPrefs ? <Loader className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {tr.savePrefs}
          </button>
        </div>
      )}
    </div>
  );
}