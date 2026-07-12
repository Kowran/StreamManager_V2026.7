import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Loader2, User, Circle, ImagePlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { useLanguage } from './LanguageProvider';
import { OnlineBadge } from './OnlineBadge';

interface OtherUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  theme_color: string | null;
  last_seen_at: string | null;
}

interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  image_url?: string | null;
  read_at: string | null;
  created_at: string;
}

interface ChatModalProps {
  otherUserId: string;
  onClose: () => void;
}

export function ChatModal({ otherUserId, onClose }: ChatModalProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  useEffect(() => {
    if (!user || !otherUserId) return;
    initChat();
  }, [user, otherUserId]);

  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel(`direct-messages:${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
          setTimeout(() => scrollToBottom(), 50);
          if (payload.new.sender_id !== user?.id) {
            markMessagesRead(chatId);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId, user]);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom(false);
  }, [messages.length]);

  async function initChat() {
    if (!user) return;
    setLoading(true);
    try {
      await loadOtherUser();
      const id = await getOrCreateChat();
      setChatId(id);
      await loadMessages(id);
      await markMessagesRead(id);
    } finally {
      setLoading(false);
    }
    setTimeout(() => scrollToBottom(false), 100);
    inputRef.current?.focus();
  }

  async function loadOtherUser() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, theme_color, last_seen_at')
      .eq('id', otherUserId)
      .maybeSingle();
    setOtherUser(data);
  }

  async function getOrCreateChat(): Promise<string> {
    if (!user) return '';
    const uid = user.id;
    const oid = otherUserId;
    const u1 = uid < oid ? uid : oid;
    const u2 = uid < oid ? oid : uid;

    const { data: existing } = await supabase
      .from('direct_chats')
      .select('id')
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created, error } = await supabase
      .from('direct_chats')
      .insert({ user1_id: u1, user2_id: u2 })
      .select('id')
      .single();

    if (error) throw error;
    return created.id;
  }

  async function loadMessages(id: string) {
    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('chat_id', id)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  }

  async function markMessagesRead(id: string) {
    if (!user) return;
    await supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('chat_id', id)
      .neq('sender_id', user.id)
      .is('read_at', null);

    const uid = user.id;
    const oid = otherUserId;
    const isUser1 = uid < oid;
    await supabase
      .from('direct_chats')
      .update(isUser1 ? { user1_unread: 0 } : { user2_unread: 0 })
      .eq('id', id);
  }

  async function uploadChatImg(file: File): Promise<string | null> {
    const fileName = `chat/${user!.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const bucket = 'support-images';
    const { error } = await supabase.storage.from(bucket).upload(fileName, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  }

  async function handleImgChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const url = await uploadChatImg(file);
      if (url) setImageUrl(url);
    } finally {
      setUploadingImg(false);
      if (imgInputRef.current) imgInputRef.current.value = '';
    }
  }

  async function sendMessage() {
    if ((!input.trim() && !imageUrl) || !chatId || !user || sending) return;
    const content = input.trim();
    const imgToSend = imageUrl;
    setInput('');
    setImageUrl(null);
    setSending(true);

    try {
      const { error } = await supabase
        .from('direct_messages')
        .insert({ chat_id: chatId, sender_id: user.id, content, image_url: imgToSend });

      if (error) throw error;

      const uid = user.id;
      const oid = otherUserId;
      const isUser1 = uid < oid;
      const preview = content.length > 60 ? content.slice(0, 60) + '…' : (imgToSend ? '📷 Image' : '');
      await supabase
        .from('direct_chats')
        .update({ last_message: preview, last_message_at: new Date().toISOString() })
        .eq('id', chatId);

      const col = isUser1 ? 'user2_unread' : 'user1_unread';
      await supabase.rpc('increment_chat_unread', { p_chat_id: chatId, p_column: col });
    } catch (err) {
      console.error('Error sending message:', err);
      setInput(content);
      setImageUrl(imgToSend);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatTime(ts: string) {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function groupMessages() {
    const groups: { date: string; messages: Message[] }[] = [];
    messages.forEach(msg => {
      const date = new Date(msg.created_at).toLocaleDateString(language === 'pt' ? 'pt-BR' : 'en-US', {
        weekday: 'long', day: 'numeric', month: 'long'
      });
      const last = groups[groups.length - 1];
      if (last && last.date === date) {
        last.messages.push(msg);
      } else {
        groups.push({ date, messages: [msg] });
      }
    });
    return groups;
  }

  const themeColor = otherUser?.theme_color || '#3b82f6';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end sm:p-4 pointer-events-none">
      <div
        className="absolute inset-0 bg-black/40 sm:hidden pointer-events-auto"
        onClick={onClose}
      />

      <div className="relative pointer-events-auto w-full sm:w-96 bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ height: 'min(580px, 90dvh)' }}>

        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ background: `linear-gradient(135deg, ${themeColor}dd, ${themeColor}aa)` }}
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-white/20 flex items-center justify-center">
            {otherUser?.avatar_url ? (
              <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="h-5 w-5 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white truncate text-sm">
              {otherUser?.full_name || (language === 'pt' ? 'Usuário' : 'User')}
            </p>
            <OnlineBadge
              lastSeenAt={otherUser?.last_seen_at}
              language={language}
              showLabel
              size="sm"
            />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 scroll-smooth">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                style={{ backgroundColor: `${themeColor}22` }}
              >
                <Circle className="h-6 w-6" style={{ color: themeColor }} />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {language === 'pt' ? 'Nenhuma mensagem ainda' : 'No messages yet'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {language === 'pt' ? 'Seja o primeiro a dizer olá!' : 'Be the first to say hello!'}
              </p>
            </div>
          ) : (
            groupMessages().map(group => (
              <div key={group.date}>
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                  <span className="text-xs text-gray-400 capitalize">{group.date}</span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                </div>
                {group.messages.map((msg, i) => {
                  const isMine = msg.sender_id === user?.id;
                  const prev = group.messages[i - 1];
                  const sameAsPrev = prev?.sender_id === msg.sender_id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${sameAsPrev ? 'mt-0.5' : 'mt-2'}`}
                    >
                      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                        <div
                          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                            isMine
                              ? 'text-white rounded-br-sm'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
                          }`}
                          style={isMine ? { backgroundColor: themeColor } : {}}
                        >
                          {msg.content && <p>{msg.content}</p>}
                          {msg.image_url && (
                            <img
                              src={msg.image_url}
                              alt="Image"
                              className="mt-1 rounded-xl max-h-48 w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(msg.image_url!, '_blank')}
                            />
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 mt-0.5 px-1">{formatTime(msg.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-gray-800 shrink-0">
          {imageUrl && (
            <div className="relative mb-2">
              <img src={imageUrl} alt="Preview" className="rounded-xl max-h-28 w-full object-cover border border-gray-200 dark:border-gray-700" />
              <button
                onClick={() => setImageUrl(null)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 bg-gray-50 dark:bg-gray-800 rounded-2xl px-3 py-2">
            <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImgChange} className="hidden" />
            <button
              onClick={() => imgInputRef.current?.click()}
              disabled={uploadingImg}
              className="shrink-0 text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-40 mb-0.5"
              title={language === 'pt' ? 'Enviar imagem' : 'Send image'}
            >
              {uploadingImg ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={1000}
              placeholder={language === 'pt' ? 'Digite uma mensagem...' : 'Type a message...'}
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 resize-none outline-none min-h-[24px] max-h-[120px] overflow-y-auto"
              style={{ lineHeight: '1.5' }}
            />
            <button
              onClick={sendMessage}
              disabled={(!input.trim() && !imageUrl) || sending}
              className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: (input.trim() || imageUrl) ? themeColor : undefined }}
            >
              {sending
                ? <Loader2 className="h-4 w-4 animate-spin text-white" />
                : <Send className="h-4 w-4 text-white" />
              }
            </button>
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-1">
            Enter {language === 'pt' ? 'para enviar' : 'to send'} · Shift+Enter {language === 'pt' ? 'para nova linha' : 'for new line'}
          </p>
        </div>
      </div>
    </div>
  );
}
