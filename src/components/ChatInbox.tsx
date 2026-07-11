import React, { useState, useEffect } from 'react';
import { MessageCircle, User, Search, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { ChatModal } from './ChatModal';
import { OnlineBadge } from './OnlineBadge';

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

export function ChatInbox() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openChatUserId, setOpenChatUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadChats();

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

      // Fetch other user profiles
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

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative">
          <MessageCircle className="h-6 w-6 text-gray-700 dark:text-gray-300" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {language === 'pt' ? 'Mensagens' : 'Messages'}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {chats.length} {language === 'pt' ? 'conversa(s)' : 'conversation(s)'}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={language === 'pt' ? 'Buscar conversa...' : 'Search conversation...'}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
        />
      </div>

      {/* Chat list */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <MessageCircle className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {search
                ? (language === 'pt' ? 'Nenhuma conversa encontrada' : 'No conversation found')
                : (language === 'pt' ? 'Nenhuma mensagem ainda' : 'No messages yet')}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {!search && (language === 'pt'
                ? 'Visite o perfil de um usuário para iniciar uma conversa'
                : 'Visit a user profile to start a conversation')}
            </p>
          </div>
        ) : (
          filtered.map((chat, idx) => (
            <button
              key={chat.id}
              onClick={() => setOpenChatUserId(chat.other_user_id)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left ${
                idx < filtered.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
              }`}
            >
              {/* Avatar */}
              <div className="relative shrink-0">
                <div
                  className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center"
                  style={{ background: chat.other_user_theme ? `${chat.other_user_theme}33` : '#f3f4f6' }}
                >
                  {chat.other_user_avatar ? (
                    <img src={chat.other_user_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                {/* Online dot */}
                <OnlineBadge
                  lastSeenAt={chat.other_user_last_seen}
                  showLabel={false}
                  size="sm"
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`text-sm truncate ${chat.unread > 0 ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-800 dark:text-gray-200'}`}>
                    {chat.other_user_name || (language === 'pt' ? 'Usuário' : 'User')}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">{formatTime(chat.last_message_at)}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className={`text-xs truncate flex-1 ${chat.unread > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                    {chat.last_message || (language === 'pt' ? 'Nenhuma mensagem' : 'No messages')}
                  </p>
                  {chat.unread > 0 && (
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {chat.unread > 9 ? '9+' : chat.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Open chat modal */}
      {openChatUserId && (
        <ChatModal
          otherUserId={openChatUserId}
          onClose={() => { setOpenChatUserId(null); loadChats(); }}
        />
      )}
    </div>
  );
}
