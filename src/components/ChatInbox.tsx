import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle, User, Search, Loader2, ArrowLeft, Settings,
  Languages, Bell, BellOff, Volume2, VolumeX, CornerDownLeft,
  Eye, EyeOff, Check, X, Trash2, Pin, Archive,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { ChatModal } from './ChatModal';
import { OnlineBadge } from './OnlineBadge';
import { ChatSettingsModal } from './ChatSettingsModal';

interface ChatPreview {
  id: string;
  other_user_id: string;
  other_user_name: string | null;
  other_user_avatar: string | null;
  other_user_theme: string | null;
  other_user_last_seen: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread: number;
  user1_id: string;
  user2_id: string;
}

interface ChatSettings {
  auto_translate: boolean;
  translate_to: string;
  show_original: boolean;
  enter_to_send: boolean;
  sound_enabled: boolean;
  outbound_translate_to: string | null;
}

const DEFAULT_SETTINGS: ChatSettings = {
  auto_translate: false,
  translate_to: 'en',
  show_original: true,
  enter_to_send: true,
  sound_enabled: true,
  outbound_translate_to: null,
};

export function ChatInbox() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openChatUserId, setOpenChatUserId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const isInitialMount = useRef(true);

  const tr = (pt: string, en: string, es: string) =>
    language === 'pt' ? pt : language === 'en' ? en : es;

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadChats();
    loadSettings();

    const channel = supabase
      .channel('direct-chats-inbox')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'direct_chats' },
        () => loadChats()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function loadSettings() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('chat_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        // Table might not exist yet, use defaults
        return;
      }

      if (data) {
        setSettings({
          auto_translate: data.auto_translate,
          translate_to: data.translate_to,
          show_original: data.show_original,
          enter_to_send: data.enter_to_send,
          sound_enabled: data.sound_enabled,
          outbound_translate_to: data.outbound_translate_to ?? null,
        });
      }
    } catch {
      // Use defaults if table doesn't exist
    }
  }

  async function saveSettings(newSettings: ChatSettings) {
    if (!user) return;
    setSettingsLoading(true);
    try {
      const { error } = await supabase
        .from('chat_settings')
        .upsert({
          user_id: user.id,
          auto_translate: newSettings.auto_translate,
          translate_to: newSettings.translate_to,
          show_original: newSettings.show_original,
          enter_to_send: newSettings.enter_to_send,
          sound_enabled: newSettings.sound_enabled,
          outbound_translate_to: newSettings.outbound_translate_to,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        // If table doesn't exist or RLS blocks, just update local state
        setSettings(newSettings);
        return;
      }

      setSettings(newSettings);
    } catch {
      setSettings(newSettings);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function loadChats() {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('direct_chats')
        .select('id, user1_id, user2_id, last_message, last_message_at, user1_unread, user2_unread')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) { setChats([]); return; }

      const otherIds = data.map(c => c.user1_id === user.id ? c.user2_id : c.user1_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, theme_color, last_seen_at')
        .in('id', otherIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const previews: ChatPreview[] = data.map(c => {
        const otherId = c.user1_id === user.id ? c.user2_id : c.user1_id;
        const profile = profileMap.get(otherId);
        const isUser1 = c.user1_id === user.id;
        return {
          id: c.id,
          user1_id: c.user1_id,
          user2_id: c.user2_id,
          other_user_id: otherId,
          other_user_name: profile?.full_name ?? null,
          other_user_avatar: profile?.avatar_url ?? null,
          other_user_theme: profile?.theme_color ?? null,
          other_user_last_seen: profile?.last_seen_at ?? null,
          last_message: c.last_message,
          last_message_at: c.last_message_at,
          unread: isUser1 ? c.user1_unread : c.user2_unread,
        };
      });

      setChats(previews);
    } catch (err) {
      console.error('Error loading chats:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(ts: string | null) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isThisYear = d.getFullYear() === now.getFullYear();
    return isThisYear
      ? d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })
      : d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  const filtered = chats.filter(c =>
    !search.trim() || (c.other_user_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = chats.reduce((acc, c) => acc + c.unread, 0);

  const showList = !isMobile || !openChatUserId;
  const showChat = !isMobile || openChatUserId;

  return (
    <div className="h-[calc(100vh-64px)] flex overflow-hidden bg-white dark:bg-gray-900">
      {/* Left sidebar - chat list */}
      {showList && (
        <div className={`${isMobile && openChatUserId ? 'hidden' : 'w-full'} md:w-80 lg:w-96 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-900`}>
          {/* Header */}
          <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-sm">
                  <MessageCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                    {tr('Mensagens', 'Messages', 'Mensajes')}
                  </h2>
                  {totalUnread > 0 && (
                    <p className="text-[11px] text-blue-500 font-medium">
                      {totalUnread} {tr('não lida(s)', 'unread', 'no leída(s)')}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-colors group"
                title={tr('Configurações', 'Settings', 'Configuración')}
              >
                <Settings className="h-4 w-4 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={tr('Buscar conversa...', 'Search conversations...', 'Buscar conversa...')}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
              />
            </div>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-gray-300 dark:text-gray-600" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                  <MessageCircle className="h-8 w-8 text-gray-300 dark:text-gray-600" />
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {search
                    ? tr('Nenhuma conversa encontrada', 'No conversation found', 'Ninguna conversa encontrada')
                    : tr('Nenhuma mensagem ainda', 'No messages yet', 'Aún no hay mensajes')}
                </p>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  {!search && tr('Visite o perfil de um usuário para iniciar uma conversa', 'Visit a user profile to start a conversation', 'Visita el perfil de un usuario para iniciar una conversa')}
                </p>
              </div>
            ) : (
              <div className="py-1">
                {filtered.map((chat) => {
                  const isActive = openChatUserId === chat.other_user_id;
                  return (
                    <button
                      key={chat.id}
                      onClick={() => setOpenChatUserId(chat.other_user_id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 mx-1 rounded-xl transition-all text-left ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                      style={{ width: 'calc(100% - 8px)' }}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div
                          className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center ring-2 ring-white dark:ring-gray-900 shadow-sm"
                          style={{ background: chat.other_user_theme ? `${chat.other_user_theme}33` : '#f3f4f6' }}
                        >
                          {chat.other_user_avatar ? (
                            <img src={chat.other_user_avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        <OnlineBadge
                          lastSeenAt={chat.other_user_last_seen}
                          showLabel={false}
                          size="sm"
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={`text-sm truncate ${chat.unread > 0 ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                            {chat.other_user_name || tr('Usuário', 'User', 'Usuario')}
                          </span>
                          <span className={`text-xs shrink-0 ${chat.unread > 0 ? 'text-blue-500 font-medium' : 'text-gray-400'}`}>
                            {formatTime(chat.last_message_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <p className={`text-xs truncate flex-1 ${chat.unread > 0 ? 'text-gray-600 dark:text-gray-300 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                            {chat.last_message || tr('Nenhuma mensagem', 'No messages', 'Sin mensajes')}
                          </p>
                          {chat.unread > 0 && (
                            <span className="shrink-0 min-w-[20px] h-5 px-1 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                              {chat.unread > 9 ? '9+' : chat.unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer with settings summary */}
          <div className="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
              <span>{chats.length} {tr('conversa(s)', 'conversation(s)', 'conversa(s)')}</span>
              <div className="flex items-center gap-2">
                {settings.auto_translate && (
                  <span className="flex items-center gap-1 text-blue-500" title={tr('Tradução automática ativa', 'Auto-translate on', 'Traducción automática activa')}>
                    <Languages className="h-3 w-3" />
                  </span>
                )}
                {settings.sound_enabled ? (
                  <Volume2 className="h-3 w-3" />
                ) : (
                  <VolumeX className="h-3 w-3" />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Right side - chat area */}
      {showChat && (
        <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
          {openChatUserId ? (
            <>
              {isMobile && (
                <button
                  onClick={() => setOpenChatUserId(null)}
                  className="md:hidden flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-b border-gray-200 dark:border-gray-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {tr('Voltar', 'Back', 'Volver')}
                </button>
              )}
              <ChatModal
                otherUserId={openChatUserId}
                onClose={() => { setOpenChatUserId(null); loadChats(); }}
                embedded
                chatSettings={settings}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-900/20 flex items-center justify-center mb-5">
                <MessageCircle className="h-10 w-10 text-blue-400 dark:text-blue-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5">
                {tr('Suas Mensagens', 'Your Messages', 'Tus Mensajes')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">
                {tr('Escolha uma conversa à esquerda para começar a conversar', 'Choose a conversation on the left to start chatting', 'Elige una conversa a la izquierda para empezar a chatear')}
              </p>
              {settings.auto_translate && (
                <div className="mt-4 flex items-center gap-1.5 text-xs text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full">
                  <Languages className="h-3.5 w-3.5" />
                  {tr('Tradução automática ativa', 'Auto-translate enabled', 'Traducción automática activa')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <ChatSettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          settings={settings}
          onSave={saveSettings}
          isSaving={settingsLoading}
        />
      )}
    </div>
  );
}
